import { isSupportedRasterImage } from './imageFormat';
import { inspectWebp } from './webp';
import {
    CONTENT_IMAGE_LIMIT,
    CONTENT_IMAGE_SOURCE_LIMIT,
    CONTENT_IMAGE_PIXEL_LIMIT,
    CONTENT_IMAGE_MAX_EDGE,
    CONTENT_IMAGE_QUALITIES
} from './blogContentImage';

function fitCeiling(width: number, height: number) {
    const edgeScale = Math.min(1, CONTENT_IMAGE_MAX_EDGE / Math.max(width, height));
    const pixelScale = Math.min(1, Math.sqrt(CONTENT_IMAGE_PIXEL_LIMIT / (width * height)));
    const scale = Math.min(edgeScale, pixelScale);
    return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export async function encodeWebpContentImage(canvas: Pick<OffscreenCanvas, 'convertToBlob'>) {
    for (const quality of CONTENT_IMAGE_QUALITIES) {
        const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
        if (blob.type !== 'image/webp')
            throw new Error(
                'This browser cannot encode WebP. Try a browser with WebP encoding support.'
            );
        if (blob.size <= CONTENT_IMAGE_LIMIT) {
            inspectWebp(new Uint8Array(await blob.arrayBuffer()), {
                maxBytes: CONTENT_IMAGE_LIMIT,
                maxPixels: CONTENT_IMAGE_PIXEL_LIMIT
            });
            return blob;
        }
    }
    throw new Error(
        'This image cannot be compressed under 500 KiB. Choose a simpler image or crop it before uploading.'
    );
}

export async function encodeAvifContentImage(canvas: OffscreenCanvas) {
    const { encode } = await import('@jsquash/avif');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is unavailable in this browser.');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const buffer = await encode(imageData);
    const blob = new Blob([buffer], { type: 'image/avif' });
    if (blob.size <= CONTENT_IMAGE_LIMIT) return blob;
    throw new Error(
        'AVIF encoding exceeded 500 KiB. This image may be too complex; choose a simpler image or crop it.'
    );
}

export async function rasterContentImage(file: Blob) {
    if (!file.size || file.size > CONTENT_IMAGE_SOURCE_LIMIT)
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
        if (bitmap.width * bitmap.height > CONTENT_IMAGE_PIXEL_LIMIT * 4)
            throw new Error('Choose an image no larger than 160 megapixels.');
        const { width, height } = fitCeiling(bitmap.width, bitmap.height);
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Image processing is unavailable in this browser.');
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(bitmap, 0, 0, width, height);
        const [webp, avif] = await Promise.all([
            encodeWebpContentImage(canvas),
            encodeAvifContentImage(canvas)
        ]);
        return { webp, avif, width, height };
    } finally {
        bitmap.close();
    }
}
