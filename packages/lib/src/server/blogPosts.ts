import type { BlogRepository, PublishedPost } from '@fkp/data';
import { publicPostFields, type PublicPostFields } from '@fkp/domain/blog.ts';
import { formatReadTime } from '@fkp/domain/formatters.ts';
import { estimateReadTime } from '@fkp/domain/readTime.ts';
import { decodeHtmlEntities } from '@fkp/mdrs';
import { publicRepositories } from './repositories';

export interface BlogPost extends PublicPostFields {
    bannerPublicUrl?: string | null;
    read_time?: string;
    comment_count?: number;
    views_count?: number;
}

const FALLBACK_READ_TIME = '1 min read';

export async function postReadTime(
    blog: BlogRepository,
    post: PublishedPost,
    timeoutMs = 3000
): Promise<string> {
    if (post.read_minutes) return formatReadTime(post.read_minutes);
    const markdown = await blog.readMarkdown(post.source, { timeoutMs });
    return markdown === null ? FALLBACK_READ_TIME : estimateReadTime(markdown);
}

export async function loadPublishedPosts(
    fetchFn: typeof fetch,
    { limit }: { limit?: number } = {}
): Promise<BlogPost[]> {
    const { blog } = publicRepositories(fetchFn);
    try {
        const { posts } = await blog.listPublishedWithStats({ limit });
        return await Promise.all(
            posts.map(async post => {
                const fields = publicPostFields(post);
                return {
                    ...fields,
                    bannerPublicUrl: post.banner_url,
                    tags: fields.tags.map(decodeHtmlEntities),
                    read_time: await postReadTime(blog, post),
                    comment_count: post.comment_count,
                    views_count: post.views_count
                } satisfies BlogPost;
            })
        );
    } catch (err) {
        console.error(err);
        return [];
    }
}
