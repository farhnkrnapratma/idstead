export function processContentImage(
    file: Blob,
    signal: AbortSignal
): Promise<{ blob: Blob; width: number; height: number }> {
    return new Promise((resolve, reject) => {
        if (signal.aborted) return reject(new Error('Image processing cancelled.'));
        const worker = new Worker(new URL('./workers/contentImage.worker.ts', import.meta.url), {
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
            reject(new Error('Image processing timed out. Choose a simpler image.'));
        }, 60_000);
        signal.addEventListener('abort', cancel, { once: true });
        worker.onerror = () => {
            stop();
            reject(new Error('Image processing failed.'));
        };
        worker.onmessage = event => {
            stop();
            if (event.data.error) reject(new Error(event.data.error));
            else resolve(event.data);
        };
        worker.postMessage({ file });
    });
}
