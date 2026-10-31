import { runImageWorker } from './imageWorker';
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
    const blob = new Blob([buffer], { type: file.type });
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;
    bitmap.close();

    if (width * height > BANNER_PIXEL_LIMIT)
        throw new Error('Choose an image no larger than 40 megapixels.');

    return runImageWorker(
        () =>
            new Worker(new URL('./workers/siteBanner.worker.ts', import.meta.url), {
                type: 'module'
            }),
        { buffer, width, height, mimeType: file.type }
    );
}
