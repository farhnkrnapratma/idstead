import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {apiError} from '$lib/server/apiError';
import {isSameOriginRequest} from '$lib/server/sameOrigin';
import {requireAdminAuth} from '$lib/server/adminCv';
import {getSupabaseAdminClient} from '$lib/server/supabaseAdmin';
import {supabase as publicSupabase} from '$lib/supabase';
import {fetchGlossaryTerms} from '$lib/author';
import {extractPostConfig} from '$lib/markdown';
import {isAiBindingAvailable} from '$lib/server/blogAi';
import {
  translatePost,
  TRANSLATION_LOCALES,
  type TranslationLocale
} from '$lib/server/blogTranslate';

function isTranslationDisabled(config: Record<string, string>): boolean {
  return (config.translate ?? '').trim().toLowerCase() === 'false';
}

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

  let body: {
    postId?: string;
    slug?: string;
    locale?: string;
    title?: string;
    excerpt?: string | null;
    summary?: string | null;
    tldr?: string[] | null;
    markdown?: string;
  };
  try {
    body = await request.json();
  } catch {
    return apiError(
      400,
      'INVALID_JSON_BODY',
      'Request body must be valid JSON.'
    );
  }

  const postId = body.postId?.trim();
  const locale = body.locale?.trim() as TranslationLocale | undefined;

  if (!postId || !locale) {
    return apiError(
      400,
      'BLOG_TRANSLATE_PARAMS_REQUIRED',
      'postId and locale are required.'
    );
  }

  if (!TRANSLATION_LOCALES.includes(locale)) {
    return apiError(
      400,
      'BLOG_TRANSLATE_INVALID_LOCALE',
      `Locale must be one of: ${TRANSLATION_LOCALES.join(', ')}`
    );
  }

  const db = getSupabaseAdminClient(platform) ?? publicSupabase;

  const {data: post} = await db
    .from('db_posts')
    .select('slug, title, excerpt, summary, tldr, storage_path')
    .eq('id', postId)
    .maybeSingle();

  if (!post) {
    return apiError(
      404,
      'BLOG_TRANSLATE_POST_NOT_FOUND',
      'No post exists with that id.'
    );
  }

  const slug = body.slug?.trim() || post.slug;
  const title = body.title?.trim() || post.title?.trim();
  let rawMarkdown = body.markdown?.trim();

  if (!rawMarkdown) {
    if (!post.storage_path) {
      return apiError(
        422,
        'BLOG_TRANSLATE_SOURCE_UNAVAILABLE',
        'The post has no stored Markdown body to translate.'
      );
    }
    const {data: file, error: downloadError} = await db.storage
      .from('blog-posts')
      .download(post.storage_path);
    if (downloadError || !file) {
      console.error('Translation source download failed:', downloadError);
      return apiError(
        422,
        'BLOG_TRANSLATE_SOURCE_UNAVAILABLE',
        'The post Markdown body could not be read from storage.'
      );
    }
    rawMarkdown = (await file.text()).trim();
  }

  if (!slug || !title || !rawMarkdown) {
    return apiError(
      422,
      'BLOG_TRANSLATE_SOURCE_UNAVAILABLE',
      'The post is missing a slug, title, or Markdown body.'
    );
  }

  const {config, body: markdown} = extractPostConfig(rawMarkdown);
  if (isTranslationDisabled(config)) {
    return json({locale, stored: false, skipped: true});
  }

  const ai = (platform as unknown as {env?: {AI?: unknown}})?.env?.AI;
  if (!isAiBindingAvailable(ai)) {
    return apiError(
      503,
      'BLOG_AI_UNAVAILABLE',
      'AI translation is temporarily unavailable. Please try again later.'
    );
  }

  const glossaryTerms = await fetchGlossaryTerms(db);

  const translation = await translatePost(
    locale,
    {
      title,
      excerpt: body.excerpt ?? post.excerpt ?? null,
      summary: body.summary ?? post.summary ?? null,
      tldr: body.tldr ?? post.tldr ?? null,
      markdown
    },
    ai,
    glossaryTerms
  );

  if (!translation) {
    return json({locale, stored: false, error: 'TRANSLATION_FAILED'});
  }

  const {data: existing} = await db
    .from('db_post_translations')
    .select('excerpt, summary, tldr, storage_path')
    .eq('post_id', postId)
    .eq('locale', locale)
    .maybeSingle();

  let storagePath: string | null = null;
  if (translation.markdown) {
    storagePath = `${slug}.${locale}.md`;
    const mdBlob = new Blob([translation.markdown], {type: 'text/markdown'});

    const {error: uploadError} = await db.storage
      .from('blog-posts')
      .upload(storagePath, mdBlob, {cacheControl: '3600', upsert: true});

    if (uploadError) {
      console.error(
        `Translation storage upload failed (${locale}):`,
        uploadError
      );
      return json({locale, stored: false, error: 'STORAGE_UPLOAD_FAILED'});
    }
  }

  const {error: upsertError} = await db
    .from('db_post_translations')
    .upsert(
      {
        post_id: postId,
        locale,
        title: translation.title,
        excerpt: translation.excerpt ?? existing?.excerpt ?? null,
        summary: translation.summary ?? existing?.summary ?? null,
        tldr: translation.tldr ?? existing?.tldr ?? null,
        storage_path: storagePath ?? existing?.storage_path ?? null,
        updated_at: new Date().toISOString()
      },
      {onConflict: 'post_id,locale'}
    );

  if (upsertError) {
    console.error(`Translation upsert failed (${locale}):`, upsertError);
    return json({locale, stored: false, error: 'DB_UPSERT_FAILED'});
  }

  return json({
    locale,
    stored: true,
    bodyTranslated:
      translation.markdownFallbackChunks === 0 && Boolean(translation.markdown),
    titleTranslated: translation.titleTranslated,
    summaryTranslated: translation.summaryTranslated,
    tldrTranslated: translation.tldrTranslated,
    chunksTotal: translation.markdownChunks,
    chunksFallenBack: translation.markdownFallbackChunks
  });
};
