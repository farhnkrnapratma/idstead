import { rasterContentImage } from '../rasterImage';

self.onmessage = async (event: MessageEvent<{ file: Blob }>) => {
    try {
        self.postMessage(await rasterContentImage(event.data.file));
    } catch (error) {
        self.postMessage({
            error: error instanceof Error ? error.message : 'Image processing failed.'
        });
    }
};
