import {
    SITE_BANNER_WIDTH,
    SITE_BANNER_HEIGHT,
    SITE_BANNER_OG_WIDTH,
    SITE_BANNER_OG_HEIGHT,
    bannerCrop
} from '../blogBanner.js';

interface MessageData {
    buffer: ArrayBuffer;
    width: number;
    height: number;
    mimeType: string;
}

interface SiteBannerOutput {
    wide: { webp: Blob; avif: Blob };
    og: { webp: Blob };
    width: number;
    height: number;
}

async function encodeWebpBanner(canvas: OffscreenCanvas): Promise<Blob> {
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 });
    if (blob.size > 512_000) throw new Error('WebP banner exceeds 500 KiB.');
    return blob;
}

async function encodeAvifBanner(canvas: OffscreenCanvas): Promise<Blob> {
    const { encode } = await import('@jsquash/avif');
    const imageData = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    const avif = await encode(imageData);
    if (avif.byteLength > 512_000) throw new Error('AVIF banner exceeds 500 KiB.');
    return new Blob([avif], { type: 'image/avif' });
}

async function rasterAndEncode(
    bitmap: ImageBitmap,
    targetWidth: number,
    targetHeight: number,
    allowUpscale: boolean
): Promise<{ webp: Blob; avif: Blob }> {
    const crop = bannerCrop(bitmap.width, bitmap.height, allowUpscale);
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, targetWidth, targetHeight);

    const [webp, avif] = await Promise.all([encodeWebpBanner(canvas), encodeAvifBanner(canvas)]);

    return { webp, avif };
}

async function rasterOgOnly(
    bitmap: ImageBitmap,
    targetWidth: number,
    targetHeight: number
): Promise<{ webp: Blob }> {
    const ogAspect = targetWidth / targetHeight;
    const srcAspect = bitmap.width / bitmap.height;
    let cropWidth = bitmap.width;
    let cropHeight = bitmap.height;

    if (srcAspect > ogAspect) {
        cropWidth = Math.round(cropHeight * ogAspect);
    } else if (srcAspect < ogAspect) {
        cropHeight = Math.round(cropWidth / ogAspect);
    }

    const x = (bitmap.width - cropWidth) / 2;
    const y = (bitmap.height - cropHeight) / 2;

    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, x, y, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);

    const webp = await encodeWebpBanner(canvas);
    return { webp };
}

self.onmessage = async (event: MessageEvent<MessageData>) => {
    try {
        const { buffer, width, height, mimeType } = event.data;

        const blob = new Blob([buffer], { type: mimeType });
        const bitmap = await createImageBitmap(blob);

        const [wide, og] = await Promise.all([
            rasterAndEncode(bitmap, SITE_BANNER_WIDTH, SITE_BANNER_HEIGHT, false),
            rasterOgOnly(bitmap, SITE_BANNER_OG_WIDTH, SITE_BANNER_OG_HEIGHT)
        ]);

        bitmap.close();

        const output: SiteBannerOutput = { wide, og, width, height };

        self.postMessage(output);
    } catch (error) {
        self.postMessage({ error: error instanceof Error ? error.message : String(error) });
    }
};
