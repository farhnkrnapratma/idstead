// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { deflate } from 'pako';

export function crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function pngHeader(width: number, height: number, colorType: number): Uint8Array {
    const header = new Uint8Array(13);
    const dimensions = new DataView(header.buffer);
    dimensions.setUint32(0, width);
    dimensions.setUint32(4, height);
    header[8] = 8;
    header[9] = colorType;
    return header;
}

function writePng(chunks: [string, Uint8Array][]): ArrayBuffer {
    const result = new Uint8Array(
        8 + chunks.reduce((sum, [, bytes]) => sum + bytes.length + 12, 0)
    );
    result.set([137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(result.buffer);
    let offset = 8;
    for (const [type, bytes] of chunks) {
        view.setUint32(offset, bytes.length);
        result.set(new TextEncoder().encode(type), offset + 4);
        result.set(bytes, offset + 8);
        view.setUint32(
            offset + 8 + bytes.length,
            crc32(result.subarray(offset + 4, offset + 8 + bytes.length))
        );
        offset += bytes.length + 12;
    }
    return result.buffer;
}

function scanlines(rows: Uint8Array | Uint8ClampedArray, rowBytes: number, height: number) {
    const data = new Uint8Array((rowBytes + 1) * height);
    for (let y = 0; y < height; y++)
        data.set(rows.subarray(y * rowBytes, (y + 1) * rowBytes), y * (rowBytes + 1) + 1);
    return deflate(data, { level: 9 });
}

export function encodePng(
    pixels: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number
): ArrayBuffer {
    if (pixels.length !== width * height * 4) throw new Error('Invalid pixel buffer.');
    return writePng([
        ['IHDR', pngHeader(width, height, 6)],
        ['IDAT', scanlines(pixels, width * 4, height)],
        ['IEND', new Uint8Array()]
    ]);
}

function colorKey(pixels: Uint8Array | Uint8ClampedArray, offset: number): number {
    if (pixels[offset + 3] === 0) return 0;
    return (
        ((pixels[offset] << 24)
            | (pixels[offset + 1] << 16)
            | (pixels[offset + 2] << 8)
            | pixels[offset + 3])
        >>> 0
    );
}

function channel(key: number, index: number): number {
    return (key >>> (24 - index * 8)) & 255;
}

interface ColorBox {
    keys: number[];
    weight: number;
    channel: number;
    range: number;
}

function colorBox(keys: number[], counts: Map<number, number>): ColorBox {
    const low = [255, 255, 255, 255];
    const high = [0, 0, 0, 0];
    let weight = 0;
    for (const key of keys) {
        weight += counts.get(key)!;
        for (let c = 0; c < 4; c++) {
            const value = channel(key, c);
            if (value < low[c]) low[c] = value;
            if (value > high[c]) high[c] = value;
        }
    }
    let widest = 0;
    for (let c = 1; c < 4; c++) if (high[c] - low[c] > high[widest] - low[widest]) widest = c;
    return { keys, weight, channel: widest, range: high[widest] - low[widest] };
}

function splitBox(box: ColorBox, counts: Map<number, number>): [ColorBox, ColorBox] {
    const sorted = [...box.keys].sort((a, b) => channel(a, box.channel) - channel(b, box.channel));
    let seen = 0;
    let cut = 1;
    for (; cut < sorted.length - 1; cut++) {
        seen += counts.get(sorted[cut - 1])!;
        if (seen * 2 >= box.weight) break;
    }
    return [colorBox(sorted.slice(0, cut), counts), colorBox(sorted.slice(cut), counts)];
}

function boxColor(box: ColorBox, counts: Map<number, number>): number[] {
    const sums = [0, 0, 0, 0];
    for (const key of box.keys) {
        const count = counts.get(key)!;
        for (let c = 0; c < 4; c++) sums[c] += channel(key, c) * count;
    }
    return sums.map(sum => Math.round(sum / box.weight));
}

function nearestColor(key: number, palette: number[][]): number {
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < palette.length; i++) {
        let distance = 0;
        for (let c = 0; c < 4; c++) {
            const delta = channel(key, c) - palette[i][c];
            distance += delta * delta;
        }
        if (distance < bestDistance) {
            bestDistance = distance;
            best = i;
        }
    }
    return best;
}

export function encodeIndexedPng(
    pixels: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number,
    colors: number
): ArrayBuffer {
    if (pixels.length !== width * height * 4) throw new Error('Invalid pixel buffer.');
    if (!Number.isInteger(colors) || colors < 2 || colors > 256)
        throw new Error('Invalid palette size.');
    const counts = new Map<number, number>();
    for (let offset = 0; offset < pixels.length; offset += 4) {
        const key = colorKey(pixels, offset);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const boxes = [colorBox([...counts.keys()], counts)];
    while (boxes.length < colors) {
        let target = -1;
        for (let i = 0; i < boxes.length; i++)
            if (
                boxes[i].keys.length > 1
                && (target < 0
                    || boxes[i].range * boxes[i].weight
                        > boxes[target].range * boxes[target].weight)
            )
                target = i;
        if (target < 0) break;
        boxes.splice(target, 1, ...splitBox(boxes[target], counts));
    }
    const palette = boxes.map(box => boxColor(box, counts));
    const lookup = new Map<number, number>();
    for (const key of counts.keys()) lookup.set(key, nearestColor(key, palette));
    const indices = new Uint8Array(width * height);
    for (let i = 0; i < indices.length; i++) indices[i] = lookup.get(colorKey(pixels, i * 4))!;
    const chunks: [string, Uint8Array][] = [
        ['IHDR', pngHeader(width, height, 3)],
        ['PLTE', Uint8Array.from(palette.flatMap(([r, g, b]) => [r, g, b]))]
    ];
    const lastTranslucent = palette.findLastIndex(([, , , alpha]) => alpha < 255);
    if (lastTranslucent >= 0)
        chunks.push([
            'tRNS',
            Uint8Array.from(palette.slice(0, lastTranslucent + 1).map(([, , , alpha]) => alpha))
        ]);
    chunks.push(['IDAT', scanlines(indices, width, height)], ['IEND', new Uint8Array()]);
    return writePng(chunks);
}
