import { publicBannerUrl } from '#lib/blogBanner.ts';
import { cdnBaseUrl } from '#lib/cdn.ts';
import { supabase } from '#lib/supabase.ts';
import { error } from '@sveltejs/kit';
import {
    renderMarkdown,
    injectHeadingIds,
    extractHeadings,
    prefixHashLinks
} from '#lib/markdown.ts';
import { estimateReadTime } from '#lib/readTime.ts';
import { publicPostFields } from '#lib/publicPost.ts';
import type { PageServerLoad } from './$types';

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

export const load: PageServerLoad = async ({ params, fetch }) => {
    const { slug } = params;

    let post;
    try {
        const { data, error: postError } = await supabase
            .from('db_posts')
            .select('*')
            .eq('slug', slug)
            .eq('published', true)
            .single();

        if (postError || !data) {
            console.error(`Post not found: ${slug}`, postError);
            throw error(404, 'Blog post not found');
        }
        post = data;
    } catch (err: unknown) {
        const errorObj = err as { status?: number };
        if (errorObj && errorObj.status) throw err;
        console.error(`Database error fetching post: ${slug}`, err);
        throw error(500, 'Internal Server Error: Could not retrieve post.');
    }

    let html: string;
    let readTime = '1 min read';
    try {
        const { data } = supabase.storage.from('blog-posts').getPublicUrl(post.storage_path);
        const fileRes = await fetch(data.publicUrl, { signal: AbortSignal.timeout(5000) });
        if (!fileRes.ok) {
            throw new Error(`Failed to fetch markdown file: ${fileRes.statusText}`);
        }
        const markdown = await fileRes.text();
        readTime = estimateReadTime(markdown);
        const rawHtml = await renderMarkdown(markdown, supabase);
        html = prefixHashLinks(injectHeadingIds(rawHtml));
    } catch (err) {
        console.error('Error fetching/rendering markdown file:', err);
        html = '<p class="text-red-500">Error: Could not render post content.</p>';
    }

    const headings = extractHeadings(html);

    let comments: BlogComment[] = [];
    try {
        const { data, error: commentsError } = await supabase
            .from('db_comments')
            .select(
                'id, parent_id, author_name, content, is_anonymous, is_admin, is_approved, created_at'
            )
            .eq('post_id', post.id)
            .eq('is_approved', true)
            .order('created_at', { ascending: true });

        if (commentsError) {
            console.error('Error fetching comments:', commentsError);
        } else {
            comments = data || [];
        }
    } catch (err) {
        console.error('Database error fetching comments:', err);
    }

    let initialViewsCount = 0;
    try {
        const { count } = await supabase
            .from('db_views')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);
        initialViewsCount = count ?? 0;
    } catch (err) {
        console.error('Error counting post views:', err);
    }

    const bannerPublicUrl = publicBannerUrl(post, cdnBaseUrl());

    let relatedPosts: RelatedPost[] = [];
    try {
        const { data, error: relatedError } = await supabase
            .from('db_posts')
            .select(
                'id, public_id, title, slug, excerpt, created_at, updated_at, banner_version, storage_path, tags, pinned'
            )
            .eq('published', true)
            .order('created_at', { ascending: false });

        if (relatedError) {
            console.error('Error fetching related posts:', relatedError);
        } else if (data) {
            relatedPosts = await Promise.all(
                getRelatedWindow(data, post.id).map(async (p: any) => {
                    const relatedBannerUrl = publicBannerUrl(
                        { ...p, published: true },
                        cdnBaseUrl()
                    );

                    let readTime = '1 min read';
                    try {
                        const { data: urlData } = supabase.storage
                            .from('blog-posts')
                            .getPublicUrl(p.storage_path);
                        const fileRes = await fetch(urlData.publicUrl, {
                            signal: AbortSignal.timeout(3000)
                        }).catch(() => null);
                        if (fileRes?.ok) {
                            readTime = estimateReadTime(await fileRes.text());
                        }
                    } catch (err) {
                        console.error('Error estimating related post read time:', err);
                    }

                    let commentCount = 0;
                    try {
                        const { count } = await supabase
                            .from('db_comments')
                            .select('*', { count: 'exact', head: true })
                            .eq('post_id', p.id)
                            .eq('is_approved', true);
                        commentCount = count ?? 0;
                    } catch (err) {
                        console.error('Error counting related post comments:', err);
                    }

                    let viewsCount = 0;
                    try {
                        const { count } = await supabase
                            .from('db_views')
                            .select('*', { count: 'exact', head: true })
                            .eq('post_id', p.id);
                        viewsCount = count ?? 0;
                    } catch (err) {
                        console.error('Error counting related post views:', err);
                    }

                    return {
                        id: p.public_id,
                        title: p.title,
                        slug: p.slug,
                        excerpt: p.excerpt ?? null,
                        created_at: p.created_at,
                        updated_at: p.updated_at ?? null,
                        bannerPublicUrl: relatedBannerUrl,
                        read_time: readTime,
                        comment_count: commentCount,
                        views_count: viewsCount,
                        tags: p.tags ?? [],
                        pinned: p.pinned ?? false
                    };
                })
            );
        }
    } catch (err) {
        console.error('Database error fetching related posts:', err);
    }

    return {
        post: { ...publicPostFields(post), read_time: readTime },
        bannerPublicUrl,
        html,
        headings,
        comments,
        relatedPosts,
        initialViewsCount
    };
};
