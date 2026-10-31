// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export function isSupportedRasterImage(bytes: Uint8Array): boolean {
    const ascii = new TextDecoder().decode(bytes);
    return (
        (bytes[0] === 137 && ascii.slice(1, 4) === 'PNG')
        || (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
        || (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP')
        || /^GIF8[79]a/.test(ascii)
        || ascii.startsWith('BM')
        || (ascii.slice(4, 8) === 'ftyp' && /avif|avis/.test(ascii.slice(8)))
    );
}
