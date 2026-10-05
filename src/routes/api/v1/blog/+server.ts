import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {supabase} from '$lib/supabase';
import {apiError} from '$lib/server/apiError';
import {
  resolveTranslationsBulk,
  isTranslationLocale
} from '$lib/server/blogTranslations';
import {TRANSLATION_LOCALES} from '$lib/translationLocales';
import {
  getTranslationDisclaimer,
  buildTranslationDisclaimerMarkdown
} from '$lib/server/blogTranslate';

import {escapePostgrestFilter} from '$lib/server/postgrestSanitize';

export const GET: RequestHandler = async ({url, request}) => {
  const id = url.searchParams.get('id')?.trim();
  const slug = url.searchParams.get('slug')?.trim();
  const search = url.searchParams.get('q')?.trim();
  const limitParam = parseInt(url.searchParams.get('limit') || '20', 10);
  const limit = Math.min(
    Math.max(1, Number.isNaN(limitParam) ? 20 : limitParam),
    100
  );
  const pageParam = parseInt(url.searchParams.get('page') || '1', 10);
  const page =
    !Number.isSafeInteger(pageParam) || pageParam < 1 ? 1 : pageParam;
  const offset = (page - 1) * limit;

  const lang = url.searchParams.get('lang')?.trim() || null;
  if (lang && !isTranslationLocale(lang)) {
    return apiError(
      400,
      'BLOG_INVALID_LANG',
      `The 'lang' query parameter must be one of: ${TRANSLATION_LOCALES.join(', ')}.`
    );
  }

  const format = url.searchParams.get('format')?.toLowerCase();
  const acceptHeader = request.headers.get('accept')?.toLowerCase() || '';
  const wantsMarkdown =
    format === 'md'
    || format === 'markdown'
    || acceptHeader.includes('text/markdown');

  let query = supabase
    .from('db_posts')
    .select(
      'id, title, slug, excerpt, summary, tldr, collaborators, created_at, updated_at',
      {count: 'exact'}
    )
    .eq('published', true)
    .order('created_at', {ascending: false});

  if (id) {
    query = query.eq('id', id);
  } else if (slug) {
    query = query.eq('slug', slug);
  }

  if (search) {
    const normalizedSearch = escapePostgrestFilter(search);
    if (normalizedSearch) {
      query = query.or(
        `title.ilike.%${normalizedSearch}%,excerpt.ilike.%${normalizedSearch}%`
      );
    }
  }

  query = query.range(offset, offset + limit - 1);

  const {data: posts, error: dbErr, count} = await query;

  if (dbErr) {
    return apiError(
      500,
      'BLOG_LIST_FETCH_FAILED',
      'Could not fetch blog posts.'
    );
  }

  const rawList = posts || [];
  const total = count ?? rawList.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const translationsByPostId = await resolveTranslationsBulk(
    supabase,
    rawList.map(p => p.id),
    lang
  );

  const list = rawList.map(p => {
    const translation = translationsByPostId.get(p.id);
    if (!translation) {
      return {
        ...p,
        language: 'en' as const,
        requested_language: isTranslationLocale(lang ?? '') ? lang : null,
        machine_translated: false
      };
    }
    return {
      ...p,
      title: translation.title ?? p.title,
      excerpt: translation.excerpt ?? p.excerpt,
      summary: translation.summary ?? p.summary,
      tldr: translation.tldr ?? p.tldr,
      language: translation.language,
      requested_language: translation.requestedLanguage,
      machine_translated: true,
      translation_disclaimer: getTranslationDisclaimer(translation.language)
    };
  });

  if (wantsMarkdown) {
    let md = `# Posts Catalog\n\nPage: ${page}/${totalPages}\nTotal posts: ${total}\n\n`;
    list.forEach(p => {
      md += `## ${p.title}\n`;
      md += `- **ID**: \`${p.id}\`\n`;
      md += `- **Slug**: \`${p.slug}\`\n`;
      md += `- **Date**: ${new Date(p.created_at).toISOString().split('T')[0]}\n`;
      md += `- **JSON Endpoint**: \`/api/v1/blog/${p.slug}\`\n`;
      md += `- **Markdown Endpoint**: \`/api/v1/blog/${p.slug}?format=md\`\n`;
      if (p.machine_translated) {
        md += `\n${buildTranslationDisclaimerMarkdown(p.language)}\n`;
      }
      if (p.excerpt) md += `\n> ${p.excerpt}\n`;
      if (p.summary) md += `\n${p.summary}\n`;
      if (p.tldr?.length) {
        md += `\n**TL;DR**\n`;
        p.tldr.forEach((point: string) => (md += `- ${point}\n`));
      }
      md += `\n---\n\n`;
    });

    return new Response(md, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate',
        'X-Robots-Tag': 'index, follow'
      }
    });
  }

  return json(
    {
      data: list,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate',
        'X-Robots-Tag': 'index, follow'
      }
    }
  );
};
