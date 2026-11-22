// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { encodeIndexedPng, encodePng } from '#lib/png.ts';
import { IMAGE_LIMIT, iconSizes, makeIco } from '#lib/siteIdentity.ts';

self.onmessage = async (event: MessageEvent<{ bitmap: ImageBitmap; background: string }>) => {
    const { bitmap, background } = event.data;
    try {
        const edge = Math.min(bitmap.width, bitmap.height);
        const files: Record<string, ArrayBuffer> = {};
        function raster(size: number, opaque = false): ImageData {
            const canvas = new OffscreenCanvas(size, size);
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Image processing is unavailable in this browser.');
            if (opaque) {
                context.fillStyle = background;
                context.fillRect(0, 0, size, size);
            }
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';
            context.drawImage(
                bitmap,
                (bitmap.width - edge) / 2,
                (bitmap.height - edge) / 2,
                edge,
                edge,
                0,
                0,
                size,
                size
            );
            return context.getImageData(0, 0, size, size);
        }
        function encode(size: number, opaque = false): ArrayBuffer {
            const pixels = raster(size, opaque);
            const lossless = encodePng(pixels.data, size, size);
            if (lossless.byteLength <= IMAGE_LIMIT) return lossless;
            for (const colors of [256, 128, 64]) {
                const encoded = encodeIndexedPng(pixels.data, size, size, colors);
                if (encoded.byteLength <= IMAGE_LIMIT) return encoded;
            }
            throw new Error('The image could not be compressed below 500 KB.');
        }
        for (const [name, size] of Object.entries(iconSizes)) {
            files[name] = encode(size, name === 'apple-touch-icon.png');
        }
        files['favicon.ico'] = makeIco([
            { size: 16, data: files['favicon-16x16.png'] },
            { size: 32, data: files['favicon-32x32.png'] },
            { size: 48, data: encode(48) }
        ]);

        const avatarPixels = raster(512);
        const avatarCanvas = new OffscreenCanvas(512, 512);
        const avatarContext = avatarCanvas.getContext('2d');
        if (!avatarContext) throw new Error('Image processing is unavailable in this browser.');
        avatarContext.putImageData(avatarPixels, 0, 0);
        const webp = await avatarCanvas.convertToBlob({ type: 'image/webp', quality: 0.8 });
        if (webp.type !== 'image/webp')
            throw new Error('This browser cannot create the WebP profile image.');
        if (webp.size > IMAGE_LIMIT) throw new Error('WebP profile image exceeds 500 KB.');
        files['avatar.webp'] = await webp.arrayBuffer();
        const { encode: encodeAvif } = await import('@jsquash/avif');
        const avif = await encodeAvif(avatarPixels);
        if (avif.byteLength > IMAGE_LIMIT) throw new Error('AVIF profile image exceeds 500 KB.');
        files['avatar.avif'] = avif;
        (
            self as unknown as { postMessage(value: unknown, transfer: Transferable[]): void }
        ).postMessage({ files }, Object.values(files));
    } catch (error) {
        self.postMessage({
            error: error instanceof Error ? error.message : 'Image processing failed.'
        });
    } finally {
        bitmap.close();
    }
};
