// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { BANNER_HEIGHT, BANNER_LIMIT, BANNER_WIDTH } from './blogBanner';

export function inspectWebp(
    bytes: Uint8Array,
    limits: { maxBytes: number; width?: number; height?: number; maxPixels?: number } = {
        maxBytes: BANNER_LIMIT,
        width: BANNER_WIDTH,
        height: BANNER_HEIGHT
    }
) {
    const invalid = () => {
        throw new Error(
            limits.width !== undefined ?
                `Banner must be a valid, still WebP image at ${limits.width} × ${limits.height} pixels and no larger than ${Math.round(limits.maxBytes / 1024)} KiB.`
            :   `Image must be a valid, still WebP image no larger than ${Math.round(limits.maxBytes / 1024)} KiB.`
        );
    };
    if (bytes.length < 20 || bytes.length > limits.maxBytes) return invalid();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const u24 = (offset: number) =>
        bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
    if (tag(0) !== 'RIFF' || tag(8) !== 'WEBP' || view.getUint32(4, true) + 8 !== bytes.length)
        return invalid();
    let offset = 12;
    let width = 0;
    let height = 0;
    let canvasWidth = 0;
    let canvasHeight = 0;
    let imageChunks = 0;
    const chunks = new Set<string>();
    while (offset < bytes.length) {
        if (offset + 8 > bytes.length) return invalid();
        const name = tag(offset);
        const size = view.getUint32(offset + 4, true);
        const start = offset + 8;
        const end = start + size;
        if (!size || end + (size % 2) > bytes.length || chunks.has(name)) return invalid();
        chunks.add(name);
        if (name === 'VP8X') {
            if (
                offset !== 12
                || size !== 10
                || bytes[start] & 0xc3
                || bytes[start + 1]
                || bytes[start + 2]
                || bytes[start + 3]
            )
                return invalid();
            canvasWidth = u24(start + 4) + 1;
            canvasHeight = u24(start + 7) + 1;
        } else if (name === 'VP8 ') {
            if (
                size < 11
                || bytes[start] & 1
                || !(bytes[start] & 16)
                || tag(start + 3).slice(0, 3) !== '\x9d\x01\x2a'
            )
                return invalid();
            if (u24(start) >>> 5 > size - 10) return invalid();
            width = view.getUint16(start + 6, true) & 0x3fff;
            height = view.getUint16(start + 8, true) & 0x3fff;
            imageChunks++;
        } else if (name === 'VP8L') {
            if (size < 6 || bytes[start] !== 0x2f || bytes[start + 4] >> 5) return invalid();
            const bits = view.getUint32(start + 1, true);
            width = (bits & 0x3fff) + 1;
            height = ((bits >>> 14) & 0x3fff) + 1;
            imageChunks++;
        } else if (name === 'ALPH') {
            if (!canvasWidth || imageChunks || size < 2) return invalid();
        } else if (!['ICCP', 'EXIF', 'XMP '].includes(name)) return invalid();
        offset = end + (size % 2);
    }
    if (
        imageChunks !== 1
        || (limits.width !== undefined && (width !== limits.width || height !== limits.height))
        || (limits.maxPixels !== undefined && width * height > limits.maxPixels)
        || (canvasWidth && (canvasWidth !== width || canvasHeight !== height))
    )
        return invalid();
    return { width, height, bytes: bytes.length, type: 'image/webp' as const };
}
