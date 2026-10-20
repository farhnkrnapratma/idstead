import type { SupabaseClient } from '@supabase/supabase-js';
import { publicCommentAuthor, type PostStats, type PublicComment } from '@idstead/domain/blog.ts';
import type { PublishedPost, Repositories } from '@idstead/data';
import { markdownToPlainText } from '@mdrs/core';
import { ApiRequestError, parseApiParams, parsePositiveInt, resolveOutput } from './params';
import { jsonResponse, textResponse } from './responses';

export interface ApiContext {
    url: URL;
    request: Request;
    db: SupabaseClient;
    repos: Repositories;
    fetch: typeof fetch;
}

export interface PublicPostMeta {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    summary: string | null;
    tldr: string[];
    tags: string[];
    collaborators: string[];
    created_at: string;
    updated_at: string;
}

export function publicPostMeta(post: PublishedPost): PublicPostMeta {
    return {
        id: post.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        summary: post.summary,
        tldr: post.tldr,
        tags: post.tags,
        collaborators: post.collaborators,
        created_at: post.created_at,
        updated_at: post.updated_at ?? post.created_at
    };
}

async function attempt<T>(work: Promise<T>, error: () => ApiRequestError): Promise<T> {
    try {
        return await work;
    } catch {
        throw error();
    }
}

async function requirePost(ctx: ApiContext, reference: string | undefined): Promise<PublishedPost> {
    if (!reference)
        throw new ApiRequestError(
            400,
            'BLOG_POST_ID_REQUIRED',
            'This endpoint needs a post ID or slug.',
            "Pass 'id' as a post ID, a unique ID prefix of at least 7 characters, or a slug."
        );
    const result = await attempt(
        ctx.repos.blog.findPublished(reference),
        () => new ApiRequestError(500, 'BLOG_POST_FETCH_FAILED', 'Could not fetch the blog post.')
    );
    if (result.status === 'found') return result.post;
    if (result.status === 'invalid')
        throw new ApiRequestError(
            400,
            'BLOG_POST_ID_INVALID',
            'The post reference is neither a post ID nor a slug.',
            `Received id '${reference.slice(0, 120)}'.`
        );
    if (result.status === 'ambiguous')
        throw new ApiRequestError(
            409,
            'BLOG_POST_ID_AMBIGUOUS',
            'The ID prefix matches more than one post.',
            `Use more characters of the ID than '${reference}'.`
        );
    throw new ApiRequestError(
        404,
        'BLOG_POST_NOT_FOUND',
        'Blog post not found.',
        `No published post matches '${reference}'.`
    );
}

function postCounts(ctx: ApiContext, post: PublishedPost): Promise<PostStats> {
    return attempt(
        ctx.repos.blog.postStats(post),
        () =>
            new ApiRequestError(
                500,
                'BLOG_POST_COUNTS_FETCH_FAILED',
                'Could not fetch post counts.'
            )
    );
}

async function postMarkdown(ctx: ApiContext, post: PublishedPost) {
    const markdown = await ctx.repos.blog.readMarkdown(post.source).catch(() => null);
    if (markdown === null)
        throw new ApiRequestError(
            502,
            'BLOG_CONTENT_FETCH_FAILED',
            'Could not fetch blog content.'
        );
    return markdown;
}

function contentPath(id: string) {
    return `/v1/blog/content?id=${id}`;
}

function day(value: string) {
    return new Date(value).toISOString().split('T')[0];
}

function metaMarkdown(meta: PublicPostMeta & Partial<PostStats>) {
    const lines = [
        `# ${meta.title}`,
        '',
        `- **ID**: \`${meta.id}\``,
        `- **Slug**: \`${meta.slug}\``,
        `- **Published**: ${day(meta.created_at)}`,
        `- **Updated**: ${day(meta.updated_at)}`
    ];
    if (meta.views_count !== undefined)
        lines.push(`- **Views**: ${meta.views_count} | **Comments**: ${meta.comment_count}`);
    if (meta.tags.length) lines.push(`- **Tags**: ${meta.tags.join(', ')}`);
    lines.push(`- **Content**: \`${contentPath(meta.id)}\``);
    if (meta.excerpt) lines.push('', `> ${meta.excerpt}`);
    if (meta.summary) lines.push('', meta.summary);
    if (meta.tldr.length) lines.push('', '**TL;DR**', ...meta.tldr.map(point => `- ${point}`));
    return lines.join('\n') + '\n';
}

function metaText(meta: PublicPostMeta & PostStats) {
    const lines = [
        meta.title,
        '',
        `ID: ${meta.id}`,
        `Slug: ${meta.slug}`,
        `Published: ${day(meta.created_at)}`,
        `Updated: ${day(meta.updated_at)}`,
        `Views: ${meta.views_count} | Comments: ${meta.comment_count}`,
        `Content: ${contentPath(meta.id)}`
    ];
    if (meta.excerpt) lines.push('', meta.excerpt);
    if (meta.summary) lines.push('', meta.summary);
    if (meta.tldr.length) lines.push('', 'TL;DR:', ...meta.tldr.map(point => `- ${point}`));
    return lines.join('\n') + '\n';
}

export async function getBlog(ctx: ApiContext) {
    const params = parseApiParams(ctx.url, ['id', 'query', 'page', 'limit', 'output']);

    if (params.has('id')) {
        if (params.has('query') || params.has('page') || params.has('limit'))
            throw new ApiRequestError(
                400,
                'PARAM_CONFLICT',
                'A single-post request cannot be combined with list parameters.',
                "'id' cannot be combined with query, page or limit."
            );
        const output = resolveOutput(params, ctx.request, ['json', 'md', 'txt'], 'json');
        const post = await requirePost(ctx, params.get('id'));
        const meta = { ...publicPostMeta(post), ...(await postCounts(ctx, post)) };
        if (output === 'md') return textResponse(metaMarkdown(meta), 'md');
        if (output === 'txt') return textResponse(metaText(meta), 'txt');
        return jsonResponse(meta);
    }

    const output = resolveOutput(params, ctx.request, ['json', 'md'], 'json');
    const limit = parsePositiveInt(params.get('limit'), 20, 100);
    const page = parsePositiveInt(params.get('page'), 1, Number.MAX_SAFE_INTEGER);
    const offset = (page - 1) * limit;

    const { posts: rows, total } = await attempt(
        ctx.repos.blog.listPublished({ limit, offset, search: params.get('query') ?? '' }),
        () => new ApiRequestError(500, 'BLOG_LIST_FETCH_FAILED', 'Could not fetch blog posts.')
    );
    const posts = rows.map(publicPostMeta);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    if (output === 'md') {
        const body = [
            '# Posts Catalog',
            '',
            `Page: ${page}/${totalPages}`,
            `Total posts: ${total}`,
            '',
            ...posts.map(meta => `${metaMarkdown(meta)}\n---\n`)
        ].join('\n');
        return textResponse(body, 'md');
    }

    return jsonResponse({
        data: posts,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    });
}

export async function getBlogContent(ctx: ApiContext) {
    const params = parseApiParams(ctx.url, ['id', 'output']);
    const output = resolveOutput(params, ctx.request, ['md', 'txt', 'json'], 'md');
    const post = await requirePost(ctx, params.get('id'));
    const markdown = await postMarkdown(ctx, post);
    if (output === 'txt') return textResponse(markdownToPlainText(markdown), 'txt');
    if (output === 'json')
        return jsonResponse({ id: post.id, slug: post.slug, title: post.title, content: markdown });
    return textResponse(markdown, 'md');
}

export interface PublicCommentThread {
    author_name: string | null;
    content: string;
    is_admin: boolean;
    is_anonymous: boolean;
    created_at: string;
    replies: PublicCommentThread[];
}

export function buildCommentTree(rows: readonly PublicComment[]): PublicCommentThread[] {
    const nodes = new Map<string, PublicCommentThread>();
    for (const row of rows)
        nodes.set(row.id, {
            author_name: publicCommentAuthor({
                author_name: row.author_name,
                is_anonymous: !!row.is_anonymous
            }),
            content: row.content,
            is_admin: !!row.is_admin,
            is_anonymous: !!row.is_anonymous,
            created_at: row.created_at,
            replies: []
        });
    const roots: PublicCommentThread[] = [];
    for (const row of rows) {
        const node = nodes.get(row.id)!;
        const parent = row.parent_id ? nodes.get(row.parent_id) : undefined;
        if (parent && row.parent_id !== row.id) parent.replies.push(node);
        else roots.push(node);
    }
    return roots;
}

export async function getBlogComments(ctx: ApiContext) {
    const params = parseApiParams(ctx.url, ['id', 'limit']);
    const limit = parsePositiveInt(params.get('limit'), 50, 100);

    const commentsFailed = () =>
        new ApiRequestError(500, 'BLOG_COMMENTS_FETCH_FAILED', 'Could not fetch comments.');

    if (params.has('id')) {
        const post = await requirePost(ctx, params.get('id'));
        const threads = buildCommentTree(
            await attempt(ctx.repos.comments.listApproved(post), commentsFailed)
        );
        return jsonResponse({
            id: post.id,
            slug: post.slug,
            data: threads.slice(0, limit),
            hasMore: threads.length > limit
        });
    }

    return jsonResponse({
        data: await attempt(ctx.repos.comments.listRecentApproved(limit), commentsFailed)
    });
}

export async function getBlogViews(ctx: ApiContext) {
    const params = parseApiParams(ctx.url, ['id']);
    const post = await requirePost(ctx, params.get('id'));
    const { views_count } = await attempt(
        ctx.repos.blog.postStats(post),
        () => new ApiRequestError(500, 'BLOG_VIEWS_FETCH_FAILED', 'Could not fetch view counts.')
    );
    return jsonResponse({ id: post.id, slug: post.slug, views: views_count });
}

export async function getSearch(ctx: ApiContext) {
    const params = parseApiParams(ctx.url, ['query', 'page', 'limit']);
    const query = params.get('query') ?? '';
    const limit = parsePositiveInt(params.get('limit'), 6, 20);
    const page = parsePositiveInt(params.get('page'), 1, Number.MAX_SAFE_INTEGER);
    const offset = (page - 1) * limit;

    if (query.length < 2 || !/[^\s,().]/.test(query))
        return jsonResponse({
            query,
            data: [],
            pagination: { page, limit, returned: 0, hasMore: false }
        });

    const { posts } = await attempt(
        ctx.repos.blog.listPublished({ search: query, offset, limit: limit + 1 }),
        () => new ApiRequestError(500, 'SEARCH_FETCH_FAILED', 'Could not search published posts.')
    );
    const results = posts
        .slice(0, limit)
        .map(post => ({
            type: 'post' as const,
            id: post.id,
            title: post.title,
            subtitle: post.excerpt ?? 'Blog post',
            url: `/blog/${post.slug}`
        }));
    return jsonResponse({
        query,
        data: results,
        pagination: { page, limit, returned: results.length, hasMore: posts.length > limit }
    });
}
