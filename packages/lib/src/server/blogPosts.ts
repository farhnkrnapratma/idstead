import type { BlogRepository, PostListOptions, PublishedPost } from '@idstead/data';
import { publicPostFields, type PublicPostFields } from '@idstead/domain/blog.ts';
import { formatReadTime } from '@idstead/domain/formatters.ts';
import { estimateReadTime } from '@idstead/domain/readTime.ts';
import { decodeHtmlEntities } from '@mdrs/core';
import { publicRepositories } from './repositories';

export interface BlogPost extends PublicPostFields {
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
    options: Pick<PostListOptions, 'limit' | 'pinnedFirst'> = {}
): Promise<BlogPost[]> {
    const { blog } = publicRepositories(fetchFn);
    try {
        const { posts } = await blog.listPublishedWithStats(options);
        return await Promise.all(
            posts.map(async post => {
                const fields = publicPostFields(post);
                return {
                    ...fields,
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
