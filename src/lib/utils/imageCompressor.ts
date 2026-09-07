export async function compressImageToWebp(
  file: File,
  maxWidth = 1280,
  maxHeight = 640,
  maxSizeBytes = 500 * 1024
): Promise<File> {
  let width: number;
  let height: number;
  let imageSource: ImageBitmap | HTMLImageElement;

  if (typeof createImageBitmap === 'function') {
    imageSource = await createImageBitmap(file);
    width = imageSource.width;
    height = imageSource.height;
  } else {
    imageSource = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image.'));
      };
      img.src = objectUrl;
    });
    width = imageSource.naturalWidth;
    height = imageSource.naturalHeight;
  }

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    if ('close' in imageSource && typeof imageSource.close === 'function') {
      imageSource.close();
    }
    throw new Error('Canvas 2D context not supported.');
  }

  ctx.drawImage(imageSource, 0, 0, width, height);
  if ('close' in imageSource && typeof imageSource.close === 'function') {
    imageSource.close();
  }

  let quality = 0.8;
  let blob: Blob | null = await new Promise(resolve =>
    canvas.toBlob(resolve, 'image/webp', quality)
  );

  while (blob && blob.size > maxSizeBytes && quality > 0.35) {
    quality -= 0.1;
    blob = await new Promise(resolve =>
      canvas.toBlob(resolve, 'image/webp', quality)
    );
  }

  if (!blob) {
    throw new Error('Failed to encode image to WebP.');
  }

  const baseName = file.name.replace(/\.[^/.]+$/, '');
  return new File([blob], `${baseName}.webp`, {type: 'image/webp'});
}
