import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {apiError} from '$lib/server/apiError';
import {isSameOriginRequest} from '$lib/server/sameOrigin';
import {requireAdminAuth} from '$lib/server/adminCv';
import {getSupabaseAdminClient} from '$lib/server/supabaseAdmin';
import {supabase as publicSupabase} from '$lib/supabase';
import {
  TRANSLATION_LOCALES,
  type TranslationLocale,
  type PostTranslationFields
} from '$lib/server/blogTranslate';

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
    translations?: Record<TranslationLocale, PostTranslationFields | null>;
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
  const slug = body.slug?.trim();
  if (!postId || !slug) {
    return apiError(
      400,
      'BLOG_TRANSLATE_STORE_POST_REQUIRED',
      'postId and slug are required.'
    );
  }

  const db = getSupabaseAdminClient(platform) ?? publicSupabase;

  const results = await Promise.allSettled(
    TRANSLATION_LOCALES.map(async locale => {
      const translation = body.translations?.[locale];
      if (!translation) {
        console.warn(`No translation to store for locale ${locale}`);
        return {locale, stored: false};
      }

      let storagePath: string | null = null;
      if (translation.markdown) {
        storagePath = `${slug}.${locale}.md`;
        const mdBlob = new Blob([translation.markdown], {
          type: 'text/markdown'
        });

        const {error: uploadError} = await db.storage
          .from('blog-posts')
          .upload(storagePath, mdBlob, {cacheControl: '3600', upsert: true});

        if (uploadError) {
          console.error(
            `Translation storage upload failed (${locale}):`,
            uploadError
          );
          return {locale, stored: false};
        }
      } else {
        console.warn(
          `No translated markdown for locale ${locale}, storing metadata only`
        );
      }

      const {error: upsertError} = await db
        .from('db_post_translations')
        .upsert(
          {
            post_id: postId,
            locale,
            title: translation.title,
            excerpt: translation.excerpt,
            summary: translation.summary,
            tldr: translation.tldr,
            storage_path: storagePath,
            updated_at: new Date().toISOString()
          },
          {onConflict: 'post_id,locale'}
        );

      if (upsertError) {
        console.error(`Translation upsert failed (${locale}):`, upsertError);
        return {locale, stored: false};
      }

      return {locale, stored: true};
    })
  );

  const stored = results.map(r =>
    r.status === 'fulfilled' ? r.value : {stored: false}
  );

  return json({stored});
};
