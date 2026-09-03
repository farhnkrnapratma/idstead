import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {apiError} from '$lib/server/apiError';
import {isSameOriginRequest} from '$lib/server/sameOrigin';
import {requireAdminAuth} from '$lib/server/adminCv';
import {getSupabaseAdminClient} from '$lib/server/supabaseAdmin';
import {extractPostConfig} from '$lib/markdown';
import {validateDefineForSave, createDbRegistry} from '$lib/define';

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

  let body: {markdown?: string};
  try {
    body = await request.json();
  } catch {
    return apiError(
      400,
      'INVALID_JSON_BODY',
      'Request body must be valid JSON.'
    );
  }

  const markdown = body.markdown?.trim();
  if (!markdown) {
    return apiError(
      400,
      'BLOG_DEFINE_MARKDOWN_REQUIRED',
      'Markdown content is required.'
    );
  }

  const {body: bodyAfterConfig} = extractPostConfig(markdown);
  const dbRegistry = createDbRegistry(getSupabaseAdminClient(platform));
  const {ok, errors} = await validateDefineForSave(bodyAfterConfig, dbRegistry);

  if (!ok) {
    return apiError(
      422,
      'BLOG_DEFINE_VALIDATION_FAILED',
      errors
        .map(e => (e.key ? `${e.key}: ${e.message}` : e.message))
        .join(' | ')
    );
  }

  return json({errors: []});
};
