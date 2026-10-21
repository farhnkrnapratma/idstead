import { error } from '@sveltejs/kit';
import {
    renderMarkdown,
    injectHeadingIds,
    extractHeadings,
    prefixHashLinks,
    type HeadingItem
} from '@mdrs/core';
import type { PublishedPost } from '@idstead/data';
import { publicPostFields } from '@idstead/domain/blog.ts';
import { estimateReadTime } from '@idstead/domain/readTime.ts';
import { parsePostRender } from '#lib/server/postRender.ts';
import { postReadTime } from '#lib/server/blogPosts.ts';
import { publicRepositories } from '#lib/server/repositories.ts';
import { createSupabaseMdrsResolvers } from '#lib/server/mdrsData.ts';
import { supabase } from '#lib/supabase.ts';
import type { PageServerLoad } from './$types';
import { siteRenderOptions } from '#lib/mdrsOptions.ts';

export interface BlogComment {
    id: string;
    parent_id: string | null;
    author_name: string;
    content: string;
    is_anonymous?: boolean;
    is_admin?: boolean;
    is_approved: boolean;
    created_at: string;
}

export interface RelatedPost {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    created_at: string | null;
    updated_at: string | null;
    bannerPublicUrl: string | null;
    read_time: string;
    comment_count: number;
    views_count: number;
    tags?: string[];
    pinned?: boolean;
}

function getRelatedWindow<T extends { id: string }>(posts: T[], currentId: string): T[] {
    const idx = posts.findIndex(p => p.id === currentId);
    if (idx === -1) return [];
    if (idx === 0) return posts.slice(1, 3);
    if (idx === posts.length - 1) return posts.slice(Math.max(0, idx - 2), idx);
    return [posts[idx - 1], posts[idx + 1]];
}

export const load: PageServerLoad = async ({ params, fetch, url }) => {
    const { blog, comments: commentRepository } = publicRepositories(fetch);

    let post: PublishedPost | null;
    try {
        post = await blog.getPublishedBySlug(params.slug);
    } catch (err) {
        console.error(`Database error fetching post: ${params.slug}`, err);
        throw error(500, 'Internal Server Error: Could not retrieve post.');
    }
    if (!post) throw error(404, 'Blog post not found');

    let html = '<p class="text-red-500">Error: Could not render post content.</p>';
    let headings: HeadingItem[] = [];
    let readTime = '1 min read';
    const storedRender = await blog.readRender(post.source, { timeoutMs: 3000 });
    const prerendered = storedRender === null ? null : parsePostRender(storedRender);
    if (prerendered) {
        ({ html, headings, readTime } = prerendered);
    } else {
        try {
            const markdown = await blog.readMarkdown(post.source, { timeoutMs: 5000 });
            if (markdown === null) throw new Error('Failed to fetch markdown file.');
            readTime = estimateReadTime(markdown);
            const rawHtml = await renderMarkdown(
                markdown,
                createSupabaseMdrsResolvers(supabase),
                siteRenderOptions(url.origin)
            );
            html = prefixHashLinks(injectHeadingIds(rawHtml));
            headings = extractHeadings(html);
        } catch (err) {
            console.error('Error fetching/rendering markdown file:', err);
        }
    }

    let comments: BlogComment[] = [];
    try {
        comments = (await commentRepository.listApproved(post)).map(comment => ({
            ...comment,
            author_name: comment.author_name ?? '',
            is_approved: true
        }));
    } catch (err) {
        console.error('Error fetching comments:', err);
    }

    let initialViewsCount = 0;
    let relatedPosts: RelatedPost[] = [];
    try {
        const { posts } = await blog.listPublishedWithStats();
        initialViewsCount = posts.find(p => p.id === post.id)?.views_count ?? 0;
        relatedPosts = await Promise.all(
            getRelatedWindow(posts, post.id).map(async related => ({
                id: related.id,
                title: related.title,
                slug: related.slug,
                excerpt: related.excerpt,
                created_at: related.created_at,
                updated_at: related.updated_at,
                bannerPublicUrl: related.banner_url,
                read_time: await postReadTime(blog, related),
                comment_count: related.comment_count,
                views_count: related.views_count,
                tags: related.tags,
                pinned: related.pinned
            }))
        );
    } catch (err) {
        console.error('Database error fetching related posts:', err);
    }

    return {
        post: { ...publicPostFields(post), read_time: readTime },
        bannerPublicUrl: post.banner_url,
        html,
        headings,
        comments,
        relatedPosts,
        initialViewsCount
    };
};
