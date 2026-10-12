import { deflate } from 'pako';

export function crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

export function encodePng(
    pixels: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number
): ArrayBuffer {
    if (pixels.length !== width * height * 4) throw new Error('Invalid pixel buffer.');
    const scanlines = new Uint8Array((width * 4 + 1) * height);
    for (let y = 0; y < height; y++)
        scanlines.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
    const header = new Uint8Array(13);
    const dimensions = new DataView(header.buffer);
    dimensions.setUint32(0, width);
    dimensions.setUint32(4, height);
    header[8] = 8;
    header[9] = 6;
    const chunks = [
        ['IHDR', header],
        ['IDAT', deflate(scanlines, { level: 9 })],
        ['IEND', new Uint8Array()]
    ] as const;
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
