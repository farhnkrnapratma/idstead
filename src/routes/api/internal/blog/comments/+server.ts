import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {supabase} from '$lib/supabase';
import {
  isNameReserved,
  extractAuthorNameTokens
} from '$lib/utils/nameValidator';
import {fetchAuthorProfile} from '$lib/author';
import {verifyTurnstileToken} from '$lib/server/turnstile';
import {apiError} from '$lib/server/apiError';
import {getSupabaseAdminClient} from '$lib/server/supabaseAdmin';
import {isSameOriginRequest} from '$lib/server/sameOrigin';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ModerationResult {
  safe: boolean;
  categories: string[];
  engine: 'llama-guard-3';
}

async function moderateContent(
  content: string,
  ai: unknown
): Promise<ModerationResult | null> {
  if (!ai || typeof (ai as {run?: unknown}).run !== 'function') {
    return null;
  }

  try {
    const runner = ai as {
      run: (model: string, input: unknown) => Promise<unknown>;
    };
    const result = await runner.run('@cf/meta/llama-guard-3-8b', {
      messages: [{role: 'user', content}],
      max_tokens: 128,
      temperature: 0
    });
    const text = String((result as {response?: string})?.response ?? '').trim();
    const isSafe = text.toLowerCase().startsWith('safe');
    const categories =
      isSafe ?
        []
      : (text
          .split('\n')[1]
          ?.split(',')
          .map(s => s.trim())
          .filter(Boolean) ?? []);
    return {safe: isSafe, categories, engine: 'llama-guard-3'};
  } catch (err) {
    console.error('Llama Guard moderation failed:', err);
    return null;
  }
}

export const POST: RequestHandler = async ({
  request,
  url,
  platform,
  getClientAddress
}) => {
  if (!isSameOriginRequest(request, url)) {
    return apiError(
      403,
      'FORBIDDEN_ORIGIN',
      'Cross-origin requests are not allowed on this endpoint.'
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return apiError(400, 'INVALID_JSON_BODY', 'Invalid JSON body.');
  }

  const turnstileToken =
    typeof body?.turnstileToken === 'string' ? body.turnstileToken : '';
  const turnstileOk = await verifyTurnstileToken(
    turnstileToken,
    getClientAddress(),
    platform
  );
  if (!turnstileOk) {
    return apiError(
      403,
      'BLOG_COMMENT_TURNSTILE_FAILED',
      'Turnstile verification failed.'
    );
  }

  const postId = typeof body?.postId === 'string' ? body.postId.trim() : '';
  const parentId =
    typeof body?.parentId === 'string' && body.parentId.trim() ?
      body.parentId.trim()
    : null;
  const isAnonymous = Boolean(body?.isAnonymous);
  const authorName =
    typeof body?.authorName === 'string' ? body.authorName.trim() : '';
  const content = typeof body?.content === 'string' ? body.content.trim() : '';

  if (!postId || !UUID_RE.test(postId)) {
    return apiError(
      400,
      'BLOG_COMMENT_INVALID_POST_ID',
      'postId is required and must be a valid UUID.'
    );
  }
  if (parentId && !UUID_RE.test(parentId)) {
    return apiError(
      400,
      'BLOG_COMMENT_INVALID_PARENT_ID',
      'parentId must be a valid UUID.'
    );
  }
  if (!content) {
    return apiError(
      400,
      'BLOG_COMMENT_CONTENT_REQUIRED',
      'content is required.'
    );
  }
  if (content.length > 2000) {
    return apiError(
      400,
      'BLOG_COMMENT_CONTENT_TOO_LONG',
      'content must be 2000 characters or fewer.',
      `Received ${content.length} characters.`
    );
  }

  if (!authorName) {
    return apiError(
      400,
      'BLOG_COMMENT_AUTHOR_NAME_REQUIRED',
      'Author name is required.'
    );
  }
  if (authorName.length < 2) {
    return apiError(
      400,
      'BLOG_COMMENT_AUTHOR_NAME_TOO_SHORT',
      'Author name must be at least 2 characters.'
    );
  }
  if (authorName.length > 50) {
    return apiError(
      400,
      'BLOG_COMMENT_AUTHOR_NAME_TOO_LONG',
      'Author name must be 50 characters or fewer.'
    );
  }

  const authorProfile = await fetchAuthorProfile(supabase);
  const authorTokens = extractAuthorNameTokens(authorProfile);
  if (isNameReserved(authorName, authorTokens)) {
    return apiError(
      400,
      'BLOG_COMMENT_AUTHOR_NAME_RESERVED',
      'This name cannot be used. Please use another name.'
    );
  }
  if (/(https?:\/\/|www\.[a-z0-9]|ftp:\/\/)/i.test(content)) {
    return apiError(
      400,
      'BLOG_COMMENT_LINKS_NOT_ALLOWED',
      'Links and URLs are not permitted in guest comments to prevent spam and phishing.'
    );
  }

  const moderation = await moderateContent(
    `Author: ${authorName}\nComment: ${content}`,
    (platform as unknown as {env?: {AI?: unknown}})?.env?.AI
  );
  if (!moderation) {
    return apiError(
      503,
      'BLOG_COMMENT_MODERATION_UNAVAILABLE',
      'Comment moderation is temporarily unavailable. Please try again later.'
    );
  }

  const adminClient = getSupabaseAdminClient(platform);
  if (!adminClient) {
    return apiError(
      500,
      'BLOG_COMMENT_SERVICE_UNAVAILABLE',
      'Comment submission is temporarily unavailable.'
    );
  }

  const {data, error: dbErr} = await adminClient
    .from('db_comments')
    .insert({
      post_id: postId,
      parent_id: parentId,
      author_name: authorName,
      content,
      is_anonymous: false,
      is_admin: false,
      is_approved: moderation.safe
    })
    .select(
      'id, post_id, parent_id, author_name, content, is_anonymous, is_admin, is_approved, created_at'
    )
    .single();

  if (dbErr) {
    console.error('Failed to insert comment:', dbErr);
    return apiError(500, 'BLOG_COMMENT_SAVE_FAILED', 'Could not save comment.');
  }

  return json(
    {
      is_approved: moderation.safe,
      comment: data,
      moderation: {engine: moderation.engine, categories: moderation.categories}
    },
    {status: 201}
  );
};
