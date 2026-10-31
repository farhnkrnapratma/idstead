import {
    SITE_BANNER_WIDTH,
    SITE_BANNER_HEIGHT,
    SITE_BANNER_OG_WIDTH,
    SITE_BANNER_OG_HEIGHT,
    bannerCrop
} from '#lib/blogBanner.ts';
import { drawToCanvas, encodeAvif } from '../rasterImage';

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

async function rasterAndEncode(
    bitmap: ImageBitmap,
    targetWidth: number,
    targetHeight: number,
    allowUpscale: boolean
): Promise<{ webp: Blob; avif: Blob }> {
    const crop = bannerCrop(bitmap.width, bitmap.height, allowUpscale);
    const canvas = drawToCanvas(bitmap, targetWidth, targetHeight, crop);
    const [webp, avif] = await Promise.all([
        encodeWebpBanner(canvas),
        encodeAvif(canvas, 512_000, 'AVIF banner exceeds 500 KiB.')
    ]);

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

    const canvas = drawToCanvas(bitmap, targetWidth, targetHeight, {
        x,
        y,
        width: cropWidth,
        height: cropHeight
    });

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
