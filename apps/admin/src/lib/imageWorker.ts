export function runImageWorker<T>(
    createWorker: () => Worker,
    message: unknown,
    options: { signal?: AbortSignal; transfer?: Transferable[] } = {}
): Promise<T> {
    const { signal, transfer = [] } = options;
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(new Error('Image processing cancelled.'));
        const worker = createWorker();
        const stop = () => {
            worker.terminate();
            clearTimeout(timer);
            signal?.removeEventListener('abort', cancel);
        };
        const cancel = () => {
            stop();
            reject(new Error('Image processing cancelled.'));
        };
        const timer = setTimeout(() => {
            stop();
            reject(new Error('Image processing timed out. Choose a simpler image.'));
        }, 60_000);
        signal?.addEventListener('abort', cancel, { once: true });
        worker.onerror = () => {
            stop();
            reject(new Error('Image processing failed.'));
        };
        worker.onmessage = (event: MessageEvent<T | { error: string }>) => {
            stop();
            const data = event.data;
            if (data && typeof data === 'object' && 'error' in data && data.error)
                reject(new Error(data.error));
            else resolve(data as T);
        };
        worker.postMessage(message, transfer);
    });
}
