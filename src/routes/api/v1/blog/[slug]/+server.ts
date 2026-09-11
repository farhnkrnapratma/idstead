import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {supabase} from '$lib/supabase';
import {apiError} from '$lib/server/apiError';
import {markdownToPlainText} from '$lib/utils/markdownToText';
import {
  resolveTranslation,
  isTranslationLocale
} from '$lib/server/blogTranslations';
import {TRANSLATION_LOCALES} from '$lib/translationLocales';
import {
  getTranslationDisclaimer,
  buildTranslationDisclaimerMarkdown
} from '$lib/server/blogTranslate';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({params, url, request, fetch}) => {
  const {slug: idOrSlug} = params;
  const isUuid = UUID_REGEX.test(idOrSlug);

  const lang = url.searchParams.get('lang')?.trim() || null;
  if (lang && !isTranslationLocale(lang)) {
    return apiError(
      400,
      'BLOG_INVALID_LANG',
      `The 'lang' query parameter must be one of: ${TRANSLATION_LOCALES.join(', ')}.`
    );
  }

  let query = supabase.from('db_posts').select('*').eq('published', true);

  if (isUuid) {
    query = query.eq('id', idOrSlug);
  } else {
    query = query.eq('slug', idOrSlug);
  }

  const {data: post, error: dbErr} = await query.maybeSingle();

  if (dbErr)
    return apiError(
      500,
      'BLOG_POST_FETCH_FAILED',
      'Could not fetch blog post.'
    );

  if (!post) {
    return apiError(
      404,
      'BLOG_POST_NOT_FOUND',
      'Blog post not found',
      `No blog post exists with ${isUuid ? 'id' : 'slug'} '${idOrSlug}'.`
    );
  }

  const translation = await resolveTranslation(supabase, post.id, lang);

  let commentCount: number;
  let viewsCount: number;
  try {
    const {count: cCount, error: commentError} = await supabase
      .from('db_comments')
      .select('*', {count: 'exact', head: true})
      .eq('post_id', post.id)
      .eq('is_approved', true);
    if (commentError) throw commentError;
    commentCount = cCount ?? 0;

    const {count: vCount, error: viewError} = await supabase
      .from('db_views')
      .select('*', {count: 'exact', head: true})
      .eq('post_id', post.id);
    if (viewError) throw viewError;
    viewsCount = vCount ?? 0;
  } catch (err) {
    return apiError(
      500,
      'BLOG_POST_COUNTS_FETCH_FAILED',
      'Could not fetch post counts.'
    );
  }

  const effectiveStoragePath = translation.storagePath ?? post.storage_path;

  if (!effectiveStoragePath)
    return apiError(
      502,
      'BLOG_CONTENT_FETCH_FAILED',
      'Could not fetch blog content.'
    );
  let rawMarkdown = '';
  if (effectiveStoragePath) {
    try {
      const {data: urlData} = supabase.storage
        .from('blog-posts')
        .getPublicUrl(effectiveStoragePath);
      const fileRes = await fetch(urlData.publicUrl);
      if (!fileRes.ok)
        return apiError(
          502,
          'BLOG_CONTENT_FETCH_FAILED',
          'Could not fetch blog content.'
        );
      if (fileRes.ok) {
        rawMarkdown = await fileRes.text();
      }
    } catch (err) {
      return apiError(
        502,
        'BLOG_CONTENT_FETCH_FAILED',
        'Could not fetch blog content.'
      );
    }
  }

  const effectiveTitle = translation.title ?? post.title;
  const effectiveExcerpt = translation.excerpt ?? post.excerpt;
  const effectiveSummary = translation.summary ?? post.summary;
  const effectiveTldr = translation.tldr ?? post.tldr;

  const format = url.searchParams.get('format')?.toLowerCase();
  const acceptHeader = request.headers.get('accept')?.toLowerCase() || '';
  const wantsMarkdown =
    format === 'md'
    || format === 'markdown'
    || acceptHeader.includes('text/markdown');
  const wantsText =
    format === 'text'
    || format === 'txt'
    || acceptHeader.includes('text/plain');

  const tldrMarkdown =
    effectiveTldr?.length ?
      `\n**TL;DR**\n${effectiveTldr.map((point: string) => `- ${point}`).join('\n')}\n`
    : '';
  const disclaimerMarkdown =
    translation.machineTranslated ?
      `\n${buildTranslationDisclaimerMarkdown(translation.language)}\n`
    : '';

  if (wantsMarkdown) {
    const markdownOutput = `# ${effectiveTitle}

- **ID**: \`${post.id}\`
- **Slug**: \`${post.slug}\`
- **Date**: ${new Date(post.created_at).toISOString().split('T')[0]}
- **Views**: ${viewsCount} | **Comments**: ${commentCount}
${disclaimerMarkdown}
> ${effectiveExcerpt || ''}
${effectiveSummary ? `\n${effectiveSummary}\n` : ''}${tldrMarkdown}
---

${rawMarkdown || effectiveExcerpt || ''}
`;
    return new Response(markdownOutput, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate',
        'X-Robots-Tag': 'index, follow'
      }
    });
  }

  if (wantsText) {
    const plainTextBody = markdownToPlainText(
      rawMarkdown || effectiveExcerpt || ''
    );
    const tldrText =
      effectiveTldr?.length ?
        `TL;DR:\n${effectiveTldr.map((point: string) => `- ${point}`).join('\n')}\n\n`
      : '';
    const disclaimerText =
      translation.machineTranslated ?
        `${getTranslationDisclaimer(translation.language)}\n\n`
      : '';
    const textOutput = `${effectiveTitle}

ID: ${post.id}
Slug: ${post.slug}
Date: ${new Date(post.created_at).toISOString().split('T')[0]}
Views: ${viewsCount} | Comments: ${commentCount}

${disclaimerText}${effectiveExcerpt ? `${effectiveExcerpt}\n\n` : ''}${effectiveSummary ? `${effectiveSummary}\n\n` : ''}${tldrText}${plainTextBody}`;

    return new Response(textOutput, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate',
        'X-Robots-Tag': 'index, follow'
      }
    });
  }

  return json(
    {
      id: post.id,
      title: effectiveTitle,
      slug: post.slug,
      excerpt: effectiveExcerpt,
      summary: effectiveSummary,
      tldr: effectiveTldr || [],
      collaborators: post.collaborators || [],
      published: post.published,
      created_at: post.created_at,
      updated_at: post.updated_at || post.created_at,
      comment_count: commentCount,
      views_count: viewsCount,
      content: rawMarkdown,
      language: translation.language,
      requested_language: translation.requestedLanguage,
      machine_translated: translation.machineTranslated,
      ...(translation.machineTranslated ?
        {translation_disclaimer: getTranslationDisclaimer(translation.language)}
      : {})
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate',
        'X-Robots-Tag': 'index, follow'
      }
    }
  );
};
