import {
    BANNER_WIDTH,
    BANNER_HEIGHT,
    BANNER_LIMIT,
    BANNER_SOURCE_LIMIT,
    BANNER_QUALITIES,
    bannerCrop
} from '#lib/blogBanner.ts';
import { inspectWebp } from '#lib/webp.ts';
import { isSupportedRasterImage } from './imageFormat';

export async function encodeWebpBanner(canvas: Pick<OffscreenCanvas, 'convertToBlob'>) {
    for (const quality of BANNER_QUALITIES) {
        const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
        if (blob.type !== 'image/webp')
            throw new Error(
                'This browser cannot encode WebP. Try a browser with WebP encoding support.'
            );
        if (blob.size <= BANNER_LIMIT) {
            inspectWebp(new Uint8Array(await blob.arrayBuffer()));
            return blob;
        }
    }
    throw new Error('This image cannot fit within 500 KiB at 1280 × 640. Choose a simpler image.');
}

export async function encodeAvifBanner(canvas: OffscreenCanvas) {
    const { encode } = await import('@jsquash/avif');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is unavailable in this browser.');
    const imageData = ctx.getImageData(0, 0, BANNER_WIDTH, BANNER_HEIGHT);
    if (!imageData) throw new Error('Image processing is unavailable in this browser.');
    const buffer = await encode(imageData);
    const blob = new Blob([buffer], { type: 'image/avif' });
    if (blob.size <= BANNER_LIMIT) return blob;
    throw new Error('AVIF encoding exceeded 500 KiB. Try a simpler image.');
}

export async function rasterBanner(file: Blob, allowUpscale = false) {
    if (!file.size || file.size > BANNER_SOURCE_LIMIT)
        throw new Error('Choose an image no larger than 10 MB.');
    const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    if (!isSupportedRasterImage(bytes))
        throw new Error('Choose a PNG, JPEG, WebP, AVIF, GIF, or BMP image.');
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
        throw new Error(
            'This image could not be decoded. Choose a valid PNG, JPEG, WebP, AVIF, GIF, or BMP image.'
        );
    }
    try {
        const crop = bannerCrop(bitmap.width, bitmap.height, allowUpscale);
        const canvas = new OffscreenCanvas(BANNER_WIDTH, BANNER_HEIGHT);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Image processing is unavailable in this browser.');
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(
            bitmap,
            crop.x,
            crop.y,
            crop.width,
            crop.height,
            0,
            0,
            BANNER_WIDTH,
            BANNER_HEIGHT
        );
        const [webpBlob, avifBlob] = await Promise.all([
            encodeWebpBanner(canvas),
            encodeAvifBanner(canvas)
        ]);
        return { webp: webpBlob, avif: avifBlob, width: bitmap.width, height: bitmap.height };
    } finally {
        bitmap.close();
    }
}
