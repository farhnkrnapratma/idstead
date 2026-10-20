import { isSupportedRasterImage } from './imageFormat';
import { UPLOAD_LIMIT, buildSvg, type ImagePackage } from '#lib/siteIdentity.ts';
import { themeColors } from '@idstead/ui/themeColors.ts';

export async function processAvatar(
    file: File,
    backgroundOrSignal: string | AbortSignal,
    maybeSignal?: AbortSignal
): Promise<ImagePackage> {
    const signal =
        typeof backgroundOrSignal === 'string' ?
            (maybeSignal ?? new AbortController().signal)
        :   backgroundOrSignal;
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
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./workers/avatar.worker.ts', import.meta.url), {
            type: 'module'
        });
        const stop = () => {
            worker.terminate();
            clearTimeout(timer);
            signal.removeEventListener('abort', cancel);
        };
        const cancel = () => {
            stop();
            reject(new Error('Image processing cancelled.'));
        };
        const timer = setTimeout(() => {
            stop();
            reject(new Error('Image processing timed out. Try a simpler image.'));
        }, 60_000);
        signal.addEventListener('abort', cancel, { once: true });
        worker.onerror = () => {
            stop();
            reject(new Error('Image processing failed.'));
        };
        worker.onmessage = event => {
            stop();
            try {
                if (event.data.error) throw new Error(event.data.error);
                const doc = new DOMParser().parseFromString(event.data.svg, 'image/svg+xml');
                const paths = Array.from(doc.querySelectorAll('path')).map(path => {
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
                buildSvg(paths);
                resolve({ files: event.data.files, paths });
            } catch (error) {
                reject(error);
            }
        };
        worker.postMessage({ bitmap, background: themeColors('light').background_color }, [bitmap]);
    });
}
