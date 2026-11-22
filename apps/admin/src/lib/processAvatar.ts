// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { isSupportedRasterImage } from './imageFormat';
import { runImageWorker } from './imageWorker';
import { UPLOAD_LIMIT, type ImagePackage } from '#lib/siteIdentity.ts';
import { themeColors } from '@idstead/ui/themeColors.ts';

export async function processAvatar(file: File, signal: AbortSignal): Promise<ImagePackage> {
    if (file.size > UPLOAD_LIMIT) throw new Error('Choose an image no larger than 10 MB.');
    const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    if (!isSupportedRasterImage(bytes))
        throw new Error('Choose a PNG, JPEG, WebP, AVIF, GIF, or BMP image.');
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
        throw new Error('This browser could not decode the image. Try PNG, JPEG, or WebP.');
    }
    if (signal.aborted) {
        bitmap.close();
        throw new Error('Cancelled.');
    }
    if (Math.min(bitmap.width, bitmap.height) < 512 || bitmap.width * bitmap.height > 40_000_000) {
        bitmap.close();
        throw new Error(
            'Choose an image at least 512 × 512 pixels and no larger than 40 megapixels.'
        );
    }
    const result = await runImageWorker<ImagePackage>(
        () =>
            new Worker(new URL('./workers/avatar.worker.ts', import.meta.url), { type: 'module' }),
        { bitmap, background: themeColors('light').background_color },
        { signal, transfer: [bitmap] }
    );
    return { files: result.files };
}
