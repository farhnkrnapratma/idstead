import { supabase } from '#lib/supabase.ts';
import { publicBannerUrl } from '#lib/blogBanner.ts';
import { cdnBaseUrl } from '#lib/cdn.ts';
import { estimateReadTime } from '#lib/readTime.ts';
import { decodeHtmlEntities } from '#lib/utils/formatters.ts';

export interface BlogPost {
    id: string;
    title: string;
    slug: string;
    published: boolean;
    pinned: boolean;
    storage_path: string;
    banner_version?: string | null;
    bannerPublicUrl?: string | null;
    created_at: string;
    updated_at?: string | null;
    excerpt?: string | null;
    content: string;
    read_time?: string;
    comment_count?: number;
    views_count?: number;
    tags?: string[];
}

async function readTime(storagePath: string, fetchFn: typeof fetch) {
    try {
        const { data } = supabase.storage.from('blog-posts').getPublicUrl(storagePath);
        const response = await fetchFn(data.publicUrl, { signal: AbortSignal.timeout(3000) }).catch(
            () => null
        );
        return response?.ok ? estimateReadTime(await response.text()) : '1 min read';
    } catch (err) {
        console.error(err);
        return '1 min read';
    }
}

async function count(table: 'db_comments' | 'db_views', postId: string) {
    try {
        let query = supabase
            .from(table)
            .select('id', { count: 'exact', head: true })
            .eq('post_id', postId);
        if (table === 'db_comments') query = query.eq('is_approved', true);
        const { count: total } = await query;
        return total ?? 0;
    } catch (err) {
        console.error(err);
        return 0;
    }
}

export async function loadPublishedPosts(
    fetchFn: typeof fetch,
    { limit }: { limit?: number } = {}
): Promise<BlogPost[]> {
    try {
        let query = supabase
            .from('db_posts')
            .select('*')
            .eq('published', true)
            .order('created_at', { ascending: false });
        if (limit) query = query.limit(limit);
        const { data, error } = await query;
        if (error || !data) return [];

        return await Promise.all(
            data.map(async post => {
                const [readTimeValue, commentCount, viewsCount] = await Promise.all([
                    readTime(post.storage_path, fetchFn),
                    count('db_comments', post.id),
                    count('db_views', post.id)
                ]);
                const { id: _internalId, public_id: publicId, ...publicPost } = post;
                return {
                    ...publicPost,
                    id: publicId as string,
                    bannerPublicUrl: publicBannerUrl(post, cdnBaseUrl()),
                    tags: Array.isArray(post.tags) ? post.tags.map(decodeHtmlEntities) : post.tags,
                    read_time: readTimeValue,
                    comment_count: commentCount,
                    views_count: viewsCount
                } as BlogPost;
            })
        );
    } catch (err) {
        console.error(err);
        return [];
    }
}
