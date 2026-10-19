import { BANNER_SOURCE_LIMIT, BANNER_PIXEL_LIMIT } from '#lib/blogBanner.ts';

export interface SiteBannerOutput {
    wide: { webp: Blob; avif: Blob };
    og: { webp: Blob };
    width: number;
    height: number;
}

export async function processSiteBanner(file: File): Promise<SiteBannerOutput> {
    if (!(file instanceof File)) throw new Error('Expected a file.');
    if (file.size > BANNER_SOURCE_LIMIT) throw new Error('Choose an image no larger than 10 MB.');

    const buffer = await file.arrayBuffer();
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context.');

    const blob = new Blob([buffer], { type: file.type });
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;

    if (width * height > BANNER_PIXEL_LIMIT)
        throw new Error('Choose an image no larger than 40 megapixels.');

    const worker = new Worker(new URL('./workers/siteBanner.worker.ts', import.meta.url), {
        type: 'module'
    });

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            worker.terminate();
            reject(new Error('Site banner encoding timeout.'));
        }, 60_000);

        worker.onmessage = (event: MessageEvent<SiteBannerOutput | { error: string }>) => {
            clearTimeout(timeout);
            worker.terminate();
            if ('error' in event.data) {
                reject(new Error(event.data.error));
            } else {
                resolve(event.data);
            }
        };

        worker.onerror = (event: ErrorEvent) => {
            clearTimeout(timeout);
            worker.terminate();
            reject(new Error(event.message || 'Worker error'));
        };

        worker.postMessage({ buffer, width, height, mimeType: file.type });
    });
}
