import type {RequestHandler} from './$types';
import sharp from 'sharp';
import {apiError} from '$lib/server/apiError';
import {isSameOriginRequest} from '$lib/server/sameOrigin';
import {requireAdminAuth} from '$lib/server/adminCv';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/tiff',
  'image/tif'
]);

const MAX_RAW_SIZE_BYTES = 25 * 1024 * 1024;
const TARGET_MAX_SIZE_BYTES = 500 * 1024;

export const POST: RequestHandler = async ({request, url, platform}) => {
  if (!isSameOriginRequest(request, url)) {
    return apiError(
      403,
      'FORBIDDEN_ORIGIN',
      'Cross-origin requests are not allowed on this endpoint.'
    );
  }

  const authError = await requireAdminAuth(request, platform);
  if (authError) return authError;

  let file: File | null = null;
  try {
    const formData = await request.formData();
    const formFile = formData.get('file');
    if (formFile instanceof File) {
      file = formFile;
    }
  } catch {
    return apiError(
      400,
      'INVALID_FORM_DATA',
      'Request body must be valid multipart form data with a "file" field.'
    );
  }

  if (!file) {
    return apiError(400, 'FILE_REQUIRED', 'An image file is required.');
  }

  if (!ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
    return apiError(
      400,
      'UNSUPPORTED_IMAGE_FORMAT',
      'Supported image formats are JPEG, PNG, WebP, AVIF, and TIFF.'
    );
  }

  if (file.size > MAX_RAW_SIZE_BYTES) {
    return apiError(
      400,
      'FILE_TOO_LARGE',
      'Original image size must not exceed 25MB.'
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    let quality = 80;
    let outputBuffer = await sharp(inputBuffer)
      .rotate()
      .resize({
        width: 1280,
        height: 640,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({quality, effort: 4})
      .toBuffer();

    while (outputBuffer.length > TARGET_MAX_SIZE_BYTES && quality > 35) {
      quality -= 10;
      outputBuffer = await sharp(inputBuffer)
        .rotate()
        .resize({
          width: 1280,
          height: 640,
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({quality, effort: 4})
        .toBuffer();
    }

    return new Response(outputBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': String(outputBuffer.length),
        'X-Compressed-Size': String(outputBuffer.length),
        'X-Compressed-Quality': String(quality)
      }
    });
  } catch (err: unknown) {
    const error = err as Error;
    return apiError(
      500,
      'IMAGE_COMPRESSION_FAILED',
      error?.message || 'Failed to compress image.'
    );
  }
};
