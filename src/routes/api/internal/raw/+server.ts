import type {RequestHandler} from './$types';
import {getLegalPage} from '$lib/server/legalPages';
import {supabase} from '$lib/supabase';
import {markdownToPlainText} from '$lib/utils/markdownToText';
import {apiError} from '$lib/server/apiError';
import {isSameOriginRequest} from '$lib/server/sameOrigin';

const LEGAL_SLUGS = new Set(['privacy', 'terms', 'security']);

export const GET: RequestHandler = async ({url, request, fetch}) => {
  if (!isSameOriginRequest(request, url)) {
    return apiError(403, 'FORBIDDEN', 'Cross-origin requests are forbidden.');
  }

  const slug = url.searchParams.get('slug')?.trim();
  const format = url.searchParams.get('format')?.toLowerCase() || 'md';
  const typeParam = url.searchParams.get('type')?.toLowerCase();

  if (!slug) {
    return apiError(400, 'BAD_REQUEST', 'Missing slug parameter');
  }

  const isLegal =
    typeParam === 'legal' || (!typeParam && LEGAL_SLUGS.has(slug));
  const wantsText = format === 'text' || format === 'txt';

  if (isLegal) {
    const pageData = await getLegalPage(slug);
    if (!pageData || !pageData.content) {
      return apiError(404, 'NOT_FOUND', 'Legal document not found');
    }

    if (wantsText) {
      const plainText = markdownToPlainText(pageData.content);
      const textOutput =
        pageData.title ? `${pageData.title}\n\n${plainText}` : plainText;
      return new Response(textOutput, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=3600, s-maxage=86400',
          'X-Robots-Tag': 'noindex'
        }
      });
    }

    return new Response(pageData.content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'X-Robots-Tag': 'noindex'
      }
    });
  }

  const {data: post, error: postErr} = await supabase
    .from('db_posts')
    .select('id, title, slug, excerpt, storage_path, created_at')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();

  if (postErr || !post) {
    return apiError(404, 'NOT_FOUND', 'Blog post not found');
  }

  let rawMarkdown = '';
  if (post.storage_path) {
    try {
      const {data: urlData} = supabase.storage
        .from('blog-posts')
        .getPublicUrl(post.storage_path);
      const fileRes = await fetch(urlData.publicUrl);
      if (fileRes.ok) {
        rawMarkdown = await fileRes.text();
      }
    } catch (err) {
      console.error('Error fetching post markdown for raw endpoint:', err);
    }
  }

  if (wantsText) {
    const plainTextBody = markdownToPlainText(
      rawMarkdown || post.excerpt || ''
    );
    const textOutput = `${post.title}\n\n${post.excerpt ? `${post.excerpt}\n\n` : ''}${plainTextBody}`;
    return new Response(textOutput, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'X-Robots-Tag': 'noindex'
      }
    });
  }

  const markdownOutput = `# ${post.title}\n\n${rawMarkdown || post.excerpt || ''}`;
  return new Response(markdownOutput, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'X-Robots-Tag': 'noindex'
    }
  });
};
