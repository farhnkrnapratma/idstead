import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {supabase} from '#lib/supabase.ts';
import {apiError} from '#lib/server/apiError.ts';
import {escapePostgrestFilter} from '#lib/server/postgrestSanitize.ts';

export const GET: RequestHandler = async ({url, request}) => {
  if (url.searchParams.has('lang')) {
    return apiError(
      400,
      'BLOG_INVALID_LANG',
      'The lang query parameter is no longer supported.'
    );
  }

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

  const list = posts || [];
  const total = count ?? list.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (wantsMarkdown) {
    let md = `# Posts Catalog\n\nPage: ${page}/${totalPages}\nTotal posts: ${total}\n\n`;
    list.forEach(p => {
      md += `## ${p.title}\n`;
      md += `- **ID**: \`${p.id}\`\n`;
      md += `- **Slug**: \`${p.slug}\`\n`;
      md += `- **Date**: ${new Date(p.created_at).toISOString().split('T')[0]}\n`;
      md += `- **JSON Endpoint**: \`/api/v1/blog/${p.slug}\`\n`;
      md += `- **Markdown Endpoint**: \`/api/v1/blog/${p.slug}?format=md\`\n`;
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
