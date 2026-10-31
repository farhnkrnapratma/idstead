import { runImageWorker } from './imageWorker';
import type { RasterOutput } from './rasterImage';

export function processContentImage(file: Blob, signal: AbortSignal): Promise<RasterOutput> {
    return runImageWorker(
        () =>
            new Worker(new URL('./workers/contentImage.worker.ts', import.meta.url), {
                type: 'module'
            }),
        { file },
        { signal }
    );
}
