import {rasterBanner} from '../bannerRaster';

self.onmessage = async (
  event: MessageEvent<{file: Blob; allowUpscale: boolean}>
) => {
  try {
    self.postMessage(
      await rasterBanner(event.data.file, event.data.allowUpscale)
    );
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Image processing failed.'
    });
  }
};
