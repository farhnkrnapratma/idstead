import decode, { init } from '@jsquash/webp/decode.js';
import { inspectAvif } from '#lib/avif.ts';
import { inspectWebp } from '#lib/webp.ts';
import { CONTENT_IMAGE_LIMIT, CONTENT_IMAGE_PIXEL_LIMIT } from '#lib/blogContentImage.ts';

let initialized: Promise<void> | undefined;

export async function validateContentImage(
    bytes: Uint8Array<ArrayBuffer>,
    module: WebAssembly.Module
) {
    const metadata = inspectWebp(bytes, {
        maxBytes: CONTENT_IMAGE_LIMIT,
        maxPixels: CONTENT_IMAGE_PIXEL_LIMIT
    });
    initialized ??= init(module);
    await initialized;
    try {
        const image = await decode(
            bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
        );
        if (
            image.width !== metadata.width
            || image.height !== metadata.height
            || image.data.length !== metadata.width * metadata.height * 4
        )
            throw new Error('Invalid WebP pixels.');
    } catch {
        throw new Error('The image contains damaged WebP data. Choose the source image again.');
    }
    return metadata;
}

export function validateContentImageAvif(
    bytes: Uint8Array,
    expected: { width: number; height: number }
) {
    return inspectAvif(bytes, { maxBytes: CONTENT_IMAGE_LIMIT, ...expected });
}
