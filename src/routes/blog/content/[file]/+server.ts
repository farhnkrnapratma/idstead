import type {RequestHandler} from './$types';
import {getContentAsset} from '#lib/server/blogContentStorage.ts';

const CONTENT_TYPES: Record<string, string> = {
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm'
};

export const GET: RequestHandler = async ({request, params, platform}) => {
  const match = params.file.match(/^([0-9a-f]{64})\.(webp|mp4|webm)$/);
  const headers = new Headers({'Cache-Control': 'no-store'});
  if (!match) return new Response(null, {status: 404, headers});
  const [, hash, ext] = match;
  try {
    const object = await getContentAsset(
      platform,
      `blog/content/${hash}.${ext}`
    );
    headers.set('Content-Type', CONTENT_TYPES[ext]);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    if (object.ETag) headers.set('ETag', object.ETag);
    if (
      object.ETag
      && request.headers
        .get('if-none-match')
        ?.split(',')
        .some(
          tag =>
            tag.trim().replace(/^W\//, '') === object.ETag || tag.trim() === '*'
        )
    )
      return new Response(null, {status: 304, headers});
    if (request.method === 'HEAD') return new Response(null, {headers});
    const body = await object.Body?.transformToByteArray();
    if (!body) throw new Error('Content body missing.');
    headers.set('Content-Length', String(body.length));
    return new Response(new Uint8Array(body), {headers});
  } catch (error) {
    return new Response(null, {
      status: error instanceof Error && error.name === 'NoSuchKey' ? 404 : 503,
      headers: {'Cache-Control': 'no-store'}
    });
  }
};

export const HEAD = GET;
