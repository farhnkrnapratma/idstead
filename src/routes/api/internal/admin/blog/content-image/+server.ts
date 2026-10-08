import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {getSupabaseAdminClient} from '#lib/server/supabaseAdmin.ts';
import {apiError} from '#lib/server/apiError.ts';
import {blogAdmin} from '#lib/server/blogPostAuth.ts';
import {boundedBody} from '#lib/server/blogPostInput.ts';
import {sha256} from '#lib/blogBanner.ts';
import {CONTENT_IMAGE_LIMIT, contentImageKey} from '#lib/blogContentImage.ts';
import {validateContentImage} from '#lib/server/validateContentImage.ts';
import {putContentAsset} from '#lib/server/blogContentStorage.ts';

export const POST: RequestHandler = async ({request, url, platform}) => {
  const db = getSupabaseAdminClient(platform);
  if (!db)
    return apiError(
      503,
      'BLOG_CONTENT_IMAGE_UNAVAILABLE',
      'Content image storage is not configured.'
    );
  const auth = await blogAdmin(request, url, db);
  if (auth.status)
    return apiError(
      auth.status,
      'BLOG_CONTENT_IMAGE_AUTH_REQUIRED',
      auth.message
    );

  let bytes: Uint8Array<ArrayBuffer>;
  try {
    const form = await (
      await boundedBody(request, CONTENT_IMAGE_LIMIT + 8192)
    ).formData();
    const file = form.get('file');
    if (!(file instanceof Blob) || !file.size)
      throw new Error('An image file is required.');
    if (file.size > CONTENT_IMAGE_LIMIT)
      throw new Error(
        'Image must be no larger than 500 KiB after compression.'
      );
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    return apiError(
      400,
      'BLOG_CONTENT_IMAGE_INVALID_INPUT',
      error instanceof Error ? error.message : 'Invalid image upload.'
    );
  }

  let metadata;
  try {
    const {default: contentWasm} = await import('virtual:banner-webp-wasm');
    metadata = await validateContentImage(bytes, contentWasm());
  } catch (error) {
    return apiError(
      400,
      'BLOG_CONTENT_IMAGE_INVALID',
      error instanceof Error ? error.message : 'Invalid image data.'
    );
  }

  const hash = await sha256(bytes);
  const key = contentImageKey(hash);
  try {
    await putContentAsset(platform, key, bytes, 'image/webp');
  } catch {
    return apiError(
      502,
      'BLOG_CONTENT_IMAGE_STORAGE_FAILED',
      'Could not store the uploaded image. Try again.'
    );
  }

  return json(
    {
      url: `/${key}`,
      width: metadata.width,
      height: metadata.height,
      bytes: metadata.bytes
    },
    {status: 201}
  );
};
