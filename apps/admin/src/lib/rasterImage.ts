import {
    BANNER_WIDTH,
    BANNER_HEIGHT,
    BANNER_LIMIT,
    BANNER_SOURCE_LIMIT,
    BANNER_QUALITIES,
    bannerCrop
} from '#lib/blogBanner.ts';
import {
    CONTENT_IMAGE_LIMIT,
    CONTENT_IMAGE_SOURCE_LIMIT,
    CONTENT_IMAGE_PIXEL_LIMIT,
    CONTENT_IMAGE_MAX_EDGE,
    CONTENT_IMAGE_QUALITIES
} from '#lib/blogContentImage.ts';
import { inspectWebp } from '#lib/webp.ts';
import { isSupportedRasterImage } from './imageFormat';

export interface RasterOutput {
    webp: Blob;
    avif: Blob;
    width: number;
    height: number;
}

interface Region {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface EncodeLimits {
    maxBytes: number;
    qualities: readonly number[];
    inspect: Parameters<typeof inspectWebp>[1];
    webpTooLarge: string;
    avifTooLarge: string;
}

async function decodeRasterImage(file: Blob, sourceLimit: number) {
    if (!file.size || file.size > sourceLimit)
        throw new Error('Choose an image no larger than 10 MB.');
    const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    if (!isSupportedRasterImage(bytes))
        throw new Error('Choose a PNG, JPEG, WebP, AVIF, GIF, or BMP image.');
    try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
        throw new Error(
            'This image could not be decoded. Choose a valid PNG, JPEG, WebP, AVIF, GIF, or BMP image.'
        );
    }
}

export function drawToCanvas(
    bitmap: ImageBitmap,
    width: number,
    height: number,
    source: Region = { x: 0, y: 0, width: bitmap.width, height: bitmap.height }
) {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is unavailable in this browser.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, source.x, source.y, source.width, source.height, 0, 0, width, height);
    return canvas;
}

async function encodeWebp(canvas: OffscreenCanvas, limits: EncodeLimits) {
    for (const quality of limits.qualities) {
        const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
        if (blob.type !== 'image/webp')
            throw new Error(
                'This browser cannot encode WebP. Try a browser with WebP encoding support.'
            );
        if (blob.size <= limits.maxBytes) {
            inspectWebp(new Uint8Array(await blob.arrayBuffer()), limits.inspect);
            return blob;
        }
    }
    throw new Error(limits.webpTooLarge);
}

export async function encodeAvif(canvas: OffscreenCanvas, maxBytes: number, tooLarge: string) {
    const { encode } = await import('@jsquash/avif');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is unavailable in this browser.');
    const buffer = await encode(context.getImageData(0, 0, canvas.width, canvas.height));
    const blob = new Blob([buffer], { type: 'image/avif' });
    if (blob.size <= maxBytes) return blob;
    throw new Error(tooLarge);
}

async function encodeBoth(canvas: OffscreenCanvas, limits: EncodeLimits) {
    const [webp, avif] = await Promise.all([
        encodeWebp(canvas, limits),
        encodeAvif(canvas, limits.maxBytes, limits.avifTooLarge)
    ]);
    return { webp, avif };
}

const BANNER_ENCODING: EncodeLimits = {
    maxBytes: BANNER_LIMIT,
    qualities: BANNER_QUALITIES,
    inspect: undefined,
    webpTooLarge: 'This image cannot fit within 500 KiB at 1280 × 640. Choose a simpler image.',
    avifTooLarge: 'AVIF encoding exceeded 500 KiB. Try a simpler image.'
};

const CONTENT_IMAGE_ENCODING: EncodeLimits = {
    maxBytes: CONTENT_IMAGE_LIMIT,
    qualities: CONTENT_IMAGE_QUALITIES,
    inspect: { maxBytes: CONTENT_IMAGE_LIMIT, maxPixels: CONTENT_IMAGE_PIXEL_LIMIT },
    webpTooLarge:
        'This image cannot be compressed under 500 KiB. Choose a simpler image or crop it before uploading.',
    avifTooLarge:
        'AVIF encoding exceeded 500 KiB. This image may be too complex; choose a simpler image or crop it.'
};

function fitCeiling(width: number, height: number) {
    const edgeScale = Math.min(1, CONTENT_IMAGE_MAX_EDGE / Math.max(width, height));
    const pixelScale = Math.min(1, Math.sqrt(CONTENT_IMAGE_PIXEL_LIMIT / (width * height)));
    const scale = Math.min(edgeScale, pixelScale);
    return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export async function rasterBanner(file: Blob): Promise<RasterOutput> {
    const bitmap = await decodeRasterImage(file, BANNER_SOURCE_LIMIT);
    try {
        const crop = bannerCrop(bitmap.width, bitmap.height);
        const canvas = drawToCanvas(bitmap, BANNER_WIDTH, BANNER_HEIGHT, crop);
        return {
            ...(await encodeBoth(canvas, BANNER_ENCODING)),
            width: bitmap.width,
            height: bitmap.height
        };
    } finally {
        bitmap.close();
    }
}

export async function rasterContentImage(file: Blob): Promise<RasterOutput> {
    const bitmap = await decodeRasterImage(file, CONTENT_IMAGE_SOURCE_LIMIT);
    try {
        if (bitmap.width * bitmap.height > CONTENT_IMAGE_PIXEL_LIMIT * 4)
            throw new Error('Choose an image no larger than 160 megapixels.');
        const { width, height } = fitCeiling(bitmap.width, bitmap.height);
        const canvas = drawToCanvas(bitmap, width, height);
        return { ...(await encodeBoth(canvas, CONTENT_IMAGE_ENCODING)), width, height };
    } finally {
        bitmap.close();
    }
}
