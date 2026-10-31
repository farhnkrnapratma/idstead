// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { isSupportedRasterImage } from './imageFormat';
import { runImageWorker } from './imageWorker';
import { UPLOAD_LIMIT, buildSvg, type ImagePackage } from '#lib/siteIdentity.ts';
import { themeColors } from '@idstead/ui/themeColors.ts';

function vectorPaths(svg: string) {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    return Array.from(doc.querySelectorAll('path')).map(path => {
        const rgb = path.getAttribute('fill')?.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
        if (!rgb) throw new Error('Invalid vector color.');
        return {
            d: path.getAttribute('d') || '',
            fill:
                '#'
                + rgb
                    .slice(1)
                    .map(value => Number(value).toString(16).padStart(2, '0'))
                    .join(''),
            opacity: Number(path.getAttribute('opacity') ?? 1)
        };
    });
}

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
    const result = await runImageWorker<{ files: ImagePackage['files']; svg: string }>(
        () =>
            new Worker(new URL('./workers/avatar.worker.ts', import.meta.url), { type: 'module' }),
        { bitmap, background: themeColors('light').background_color },
        { signal, transfer: [bitmap] }
    );
    const paths = vectorPaths(result.svg);
    buildSvg(paths);
    return { files: result.files, paths };
}
