import decode, { init } from '@jsquash/webp/decode.js';
import { inspectWebp } from '#lib/webp.ts';

let initialized: Promise<void> | undefined;

export async function validateBanner(bytes: Uint8Array<ArrayBuffer>, module: WebAssembly.Module) {
    const metadata = inspectWebp(bytes);
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
        throw new Error(
            'The banner contains damaged WebP image data. Choose the source image again.'
        );
    }
    return metadata;
}
