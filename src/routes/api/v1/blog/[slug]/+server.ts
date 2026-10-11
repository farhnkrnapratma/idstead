import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '#lib/supabase.ts';
import { apiError } from '#lib/server/apiError.ts';
import { markdownToPlainText } from '#lib/utils/markdownToText.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({ params, url, request, fetch }) => {
    const { slug: idOrSlug } = params;
    const isUuid = UUID_REGEX.test(idOrSlug);

    let query = supabase.from('db_posts').select('*').eq('published', true);

    if (isUuid) {
        query = query.eq('id', idOrSlug);
    } else {
        query = query.eq('slug', idOrSlug);
    }

    const { data: post, error: dbErr } = await query.maybeSingle();

    if (dbErr) return apiError(500, 'BLOG_POST_FETCH_FAILED', 'Could not fetch blog post.');

    if (!post) {
        return apiError(
            404,
            'BLOG_POST_NOT_FOUND',
            'Blog post not found',
            `No blog post exists with ${isUuid ? 'id' : 'slug'} '${idOrSlug}'.`
        );
    }

    let commentCount: number;
    let viewsCount: number;
    try {
        const { count: cCount, error: commentError } = await supabase
            .from('db_comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id)
            .eq('is_approved', true);
        if (commentError) throw commentError;
        commentCount = cCount ?? 0;

        const { count: vCount, error: viewError } = await supabase
            .from('db_views')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);
        if (viewError) throw viewError;
        viewsCount = vCount ?? 0;
    } catch (err) {
        return apiError(500, 'BLOG_POST_COUNTS_FETCH_FAILED', 'Could not fetch post counts.');
    }

    if (!post.storage_path)
        return apiError(502, 'BLOG_CONTENT_FETCH_FAILED', 'Could not fetch blog content.');
    let rawMarkdown = '';
    if (post.storage_path) {
        try {
            const { data: urlData } = supabase.storage
                .from('blog-posts')
                .getPublicUrl(post.storage_path);
            const fileRes = await fetch(urlData.publicUrl);
            if (!fileRes.ok)
                return apiError(502, 'BLOG_CONTENT_FETCH_FAILED', 'Could not fetch blog content.');
            if (fileRes.ok) {
                rawMarkdown = await fileRes.text();
            }
        } catch (err) {
            return apiError(502, 'BLOG_CONTENT_FETCH_FAILED', 'Could not fetch blog content.');
        }
    }

    const format = url.searchParams.get('format')?.toLowerCase();
    const acceptHeader = request.headers.get('accept')?.toLowerCase() || '';
    const wantsMarkdown =
        format === 'md' || format === 'markdown' || acceptHeader.includes('text/markdown');
    const wantsText = format === 'text' || format === 'txt' || acceptHeader.includes('text/plain');

    const tldrMarkdown =
        post.tldr?.length ?
            `\n**TL;DR**\n${post.tldr.map((point: string) => `- ${point}`).join('\n')}\n`
        :   '';
    if (wantsMarkdown) {
        const markdownOutput = `# ${post.title}

- **ID**: \`${post.id}\`
- **Slug**: \`${post.slug}\`
- **Date**: ${new Date(post.created_at).toISOString().split('T')[0]}
- **Views**: ${viewsCount} | **Comments**: ${commentCount}

> ${post.excerpt || ''}
${post.summary ? `\n${post.summary}\n` : ''}${tldrMarkdown}
---

${rawMarkdown || post.excerpt || ''}
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
        const plainTextBody = markdownToPlainText(rawMarkdown || post.excerpt || '');
        const tldrText =
            post.tldr?.length ?
                `TL;DR:\n${post.tldr.map((point: string) => `- ${point}`).join('\n')}\n\n`
            :   '';
        const textOutput = `${post.title}

ID: ${post.id}
Slug: ${post.slug}
Date: ${new Date(post.created_at).toISOString().split('T')[0]}
Views: ${viewsCount} | Comments: ${commentCount}

${post.excerpt ? `${post.excerpt}\n\n` : ''}${post.summary ? `${post.summary}\n\n` : ''}${tldrText}${plainTextBody}`;

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
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            summary: post.summary,
            tldr: post.tldr || [],
            collaborators: post.collaborators || [],
            published: post.published,
            created_at: post.created_at,
            updated_at: post.updated_at || post.created_at,
            comment_count: commentCount,
            views_count: viewsCount,
            content: rawMarkdown
        },
        {
            headers: {
                'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate',
                'X-Robots-Tag': 'index, follow'
            }
        }
    );
};
