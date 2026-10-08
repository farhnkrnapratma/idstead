import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {getSupabaseAdminClient} from '#lib/server/supabaseAdmin.ts';
import {blogAdmin} from '#lib/server/blogPostAuth.ts';
import {cleanupBlogAssets} from '#lib/server/blogBannerStorage.ts';
import {apiError} from '#lib/server/apiError.ts';

export const POST: RequestHandler = async ({request, url, platform}) => {
  const db = getSupabaseAdminClient(platform);
  if (!db)
    return apiError(
      503,
      'BLOG_CLEANUP_UNAVAILABLE',
      'Storage is not configured.'
    );
  const auth = await blogAdmin(request, url, db);
  if (auth.status)
    return apiError(auth.status, 'BLOG_CLEANUP_AUTH_REQUIRED', auth.message);
  try {
    return json(await cleanupBlogAssets(db, platform), {
      headers: {'Cache-Control': 'no-store'}
    });
  } catch {
    return apiError(
      503,
      'BLOG_CLEANUP_FAILED',
      'Cleanup failed. Saved posts are safe; retry shortly.'
    );
  }
};
