// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { deflate } from 'pako';
import { crc32, encodePng } from '../packages/lib/src/png.ts';
import { iconSizes } from '../packages/lib/src/siteIdentity.ts';

export const ascii = (text: string) => new TextEncoder().encode(text);

export function concat(parts: Uint8Array[]) {
    const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
}

export function u32(value: number, little = false) {
    const out = new Uint8Array(4);
    new DataView(out.buffer).setUint32(0, value, little);
    return out;
}

export function riff(chunks: Array<[string, Uint8Array]>) {
    const body = concat([
        ascii('WEBP'),
        ...chunks.map(([name, data]) =>
            concat([ascii(name), u32(data.length, true), data, new Uint8Array(data.length % 2)])
        )
    ]);
    return concat([ascii('RIFF'), u32(body.length, true), body]);
}

export function vp8(width: number, height: number) {
    const data = new Uint8Array(12);
    data[0] = 0x10;
    data.set([0x9d, 0x01, 0x2a], 3);
    new DataView(data.buffer).setUint16(6, width, true);
    new DataView(data.buffer).setUint16(8, height, true);
    return data;
}

export function vp8l(width: number, height: number) {
    const data = new Uint8Array(6);
    data[0] = 0x2f;
    new DataView(data.buffer).setUint32(1, (width - 1) | ((height - 1) << 14), true);
    return data;
}

export function vp8x(width: number, height: number, flags = 0x10) {
    const data = new Uint8Array(10);
    data[0] = flags;
    data.set([(width - 1) & 255, ((width - 1) >> 8) & 255, (width - 1) >> 16], 4);
    data.set([(height - 1) & 255, ((height - 1) >> 8) & 255, (height - 1) >> 16], 7);
    return data;
}

export function box(type: string, payload: Uint8Array) {
    return concat([u32(payload.length + 8), ascii(type), payload]);
}

export function avif(
    width: number,
    height: number,
    overrides: { brand?: string; skip?: string } = {}
) {
    const ispe = box('ispe', concat([new Uint8Array(4), u32(width), u32(height)]));
    const parts = [
        box('ftyp', concat([ascii(overrides.brand ?? 'avif'), new Uint8Array(4)])),
        overrides.skip === 'meta' ?
            new Uint8Array(0)
        :   box('meta', concat([new Uint8Array(4), box('iprp', box('ipco', ispe))])),
        overrides.skip === 'mdat' ? new Uint8Array(0) : box('mdat', new Uint8Array(4))
    ];
    return concat(parts);
}

export function solidPng(size: number) {
    return new Uint8Array(encodePng(new Uint8Array(size * size * 4).fill(255), size, size));
}

export function pngChunk(name: string, data: Uint8Array) {
    const body = concat([ascii(name), data]);
    return concat([u32(data.length), body, u32(crc32(body))]);
}

export function rebuildPng(png: Uint8Array, edit: (chunks: Array<[string, Uint8Array]>) => void) {
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    const chunks: Array<[string, Uint8Array]> = [];
    for (let pos = 8; pos < png.length;) {
        const length = view.getUint32(pos);
        chunks.push([
            String.fromCharCode(...png.subarray(pos + 4, pos + 8)),
            png.slice(pos + 8, pos + 8 + length)
        ]);
        pos += length + 12;
    }
    edit(chunks);
    return concat([png.slice(0, 8), ...chunks.map(([name, data]) => pngChunk(name, data))]);
}

export function ico(
    parts: Uint8Array[],
    overrides: { count?: number; lengthOffset?: number } = {}
) {
    const header = new Uint8Array(54);
    const view = new DataView(header.buffer);
    view.setUint16(2, 1, true);
    view.setUint16(4, overrides.count ?? 3, true);
    let offset = 54;
    parts.forEach((part, index) => {
        header[6 + index * 16] = [16, 32, 48][index];
        header[7 + index * 16] = [16, 32, 48][index];
        view.setUint32(14 + index * 16, part.length, true);
        view.setUint32(18 + index * 16, offset + (overrides.lengthOffset ?? 0), true);
        offset += part.length;
    });
    return concat([header, ...parts]);
}

export const sizes = [16, 32, 48].map(solidPng);

export const avatarAvif = await Bun.file(
    new URL('./fixtures/avatar-512.avif', import.meta.url)
).bytes();
export const webp512 = riff([['VP8L', vp8l(512, 512)]]);
export const vector = JSON.stringify([{ d: 'M0 0L10 10Z', fill: '#112233', opacity: 1 }]);

export function avatarForm(overrides: Record<string, FormDataEntryValue | null> = {}) {
    const form = new FormData();
    const entries: Record<string, FormDataEntryValue | null> = {};
    for (const [name, size] of Object.entries(iconSizes))
        entries[name] = new File([solidPng(size)], name);
    entries['favicon.ico'] = new File([ico(sizes)], 'favicon.ico');
    entries.vector = vector;
    entries['avatar.webp'] = new File([webp512], 'avatar.webp');
    entries['avatar.avif'] = new File([avatarAvif], 'avatar.avif');
    for (const [name, value] of Object.entries({ ...entries, ...overrides }))
        if (value !== null) form.set(name, value);
    return form;
}

export const bannerAvif = await Bun.file(
    new URL('./fixtures/banner-1280x640.avif', import.meta.url)
).bytes();

export function bannerEntries(): Record<string, File> {
    return {
        'banner.webp': new File([riff([['VP8L', vp8l(1280, 640)]])], 'banner.webp'),
        'banner.avif': new File([bannerAvif], 'banner.avif'),
        'banner-og.webp': new File([riff([['VP8L', vp8l(1200, 630)]])], 'banner-og.webp')
    };
}
