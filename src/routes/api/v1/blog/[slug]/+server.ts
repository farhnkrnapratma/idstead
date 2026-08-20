import {json, error} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {supabase} from '$lib/supabase';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({params, url, request, fetch}) => {
  const {slug: idOrSlug} = params;
  const isUuid = UUID_REGEX.test(idOrSlug);

  let query = supabase.from('db_posts').select('*').eq('published', true);

  if (isUuid) {
    query = query.eq('id', idOrSlug);
  } else {
    query = query.eq('slug', idOrSlug);
  }

  const {data: post, error: dbErr} = await query.maybeSingle();

  if (dbErr || !post) {
    throw error(404, {
      message: 'Blog post not found',
      code: 'BLOG_POST_NOT_FOUND',
      details: `No blog post exists with ${isUuid ? 'id' : 'slug'} '${idOrSlug}'.`
    });
  }

  let commentCount = 0;
  let viewsCount = 0;
  try {
    const {count: cCount} = await supabase
      .from('db_comments')
      .select('*', {count: 'exact', head: true})
      .eq('post_id', post.id)
      .eq('is_approved', true);
    commentCount = cCount ?? 0;

    const {count: vCount} = await supabase
      .from('db_views')
      .select('*', {count: 'exact', head: true})
      .eq('post_id', post.id);
    viewsCount = vCount ?? 0;
  } catch (err) {
    console.error('Error fetching post counts:', err);
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
      console.error('Error fetching post markdown file:', err);
    }
  }

  const format = url.searchParams.get('format')?.toLowerCase();
  const acceptHeader = request.headers.get('accept')?.toLowerCase() || '';
  const wantsMarkdown =
    format === 'md'
    || format === 'markdown'
    || acceptHeader.includes('text/markdown');

  if (wantsMarkdown) {
    const markdownOutput = `# ${post.title}

- **ID**: \`${post.id}\`
- **Slug**: \`${post.slug}\`
- **Date**: ${new Date(post.created_at).toISOString().split('T')[0]}
- **Views**: ${viewsCount} | **Comments**: ${commentCount}

> ${post.excerpt || ''}

---

${rawMarkdown || post.excerpt || ''}
`;
    return new Response(markdownOutput, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'X-Robots-Tag': 'index, follow'
      }
    });
  }

  return json(
    {
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      published: post.published,
      created_at: post.created_at,
      updated_at: post.updated_at || post.created_at,
      comment_count: commentCount,
      views_count: viewsCount,
      content: rawMarkdown
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'X-Robots-Tag': 'index, follow'
      }
    }
  );
};
