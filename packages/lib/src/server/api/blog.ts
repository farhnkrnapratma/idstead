import type { SupabaseClient } from '@supabase/supabase-js';
import { findPost } from '#lib/server/postLookup.ts';
import { escapePostgrestFilter } from '#lib/server/postgrestSanitize.ts';
import { markdownToPlainText } from '@fkp/mdrs';
import { ApiRequestError, parseApiParams, parsePositiveInt, resolveOutput } from './params';
import { jsonResponse, textResponse } from './responses';

export interface ApiContext {
    url: URL;
    request: Request;
    db: SupabaseClient;
    fetch: typeof fetch;
}

const POST_COLUMNS =
    'id, public_id, title, slug, excerpt, summary, tldr, tags, collaborators, created_at, updated_at, storage_path';

interface PostRow {
    id: string;
    public_id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    summary: string | null;
    tldr: string[] | null;
    tags: string[] | null;
    collaborators: string[] | null;
    created_at: string;
    updated_at: string | null;
    storage_path: string | null;
    [key: string]: unknown;
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

export function publicPostMeta(row: PostRow): PublicPostMeta {
    return {
        id: row.public_id,
        slug: row.slug,
        title: row.title,
        excerpt: row.excerpt,
        summary: row.summary,
        tldr: row.tldr ?? [],
        tags: row.tags ?? [],
        collaborators: row.collaborators ?? [],
        created_at: row.created_at,
        updated_at: row.updated_at ?? row.created_at
    };
}

async function requirePost(ctx: ApiContext, reference: string | undefined): Promise<PostRow> {
    if (!reference)
        throw new ApiRequestError(
            400,
            'BLOG_POST_ID_REQUIRED',
            'This endpoint needs a post ID or slug.',
            "Pass 'id' as a post ID, a unique ID prefix of at least 7 characters, or a slug."
        );
    const result = await findPost<PostRow>(ctx.db, reference, POST_COLUMNS);
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
    if (result.status === 'error')
        throw new ApiRequestError(500, 'BLOG_POST_FETCH_FAILED', 'Could not fetch the blog post.');
    throw new ApiRequestError(
        404,
        'BLOG_POST_NOT_FOUND',
        'Blog post not found.',
        `No published post matches '${reference}'.`
    );
}

async function postCounts(db: SupabaseClient, postId: string) {
    const [comments, views] = await Promise.all([
        db
            .from('db_comments')
            .select('id', { count: 'exact', head: true })
            .eq('post_id', postId)
            .eq('is_approved', true),
        db.from('db_views').select('id', { count: 'exact', head: true }).eq('post_id', postId)
    ]);
    if (comments.error || views.error)
        throw new ApiRequestError(
            500,
            'BLOG_POST_COUNTS_FETCH_FAILED',
            'Could not fetch post counts.'
        );
    return { comment_count: comments.count ?? 0, views_count: views.count ?? 0 };
}

async function countPublished(db: SupabaseClient, search: string): Promise<number> {
    let query = db
        .from('db_posts')
        .select('public_id', { count: 'exact', head: true })
        .eq('published', true);
    if (search) query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
    const { count, error } = await query;
    if (error)
        throw new ApiRequestError(500, 'BLOG_LIST_FETCH_FAILED', 'Could not fetch blog posts.');
    return count ?? 0;
}

async function postMarkdown(ctx: ApiContext, row: PostRow) {
    const failure = new ApiRequestError(
        502,
        'BLOG_CONTENT_FETCH_FAILED',
        'Could not fetch blog content.'
    );
    if (!row.storage_path) throw failure;
    try {
        const { data } = ctx.db.storage.from('blog-posts').getPublicUrl(row.storage_path);
        const response = await ctx.fetch(data.publicUrl);
        if (!response.ok) throw failure;
        return await response.text();
    } catch {
        throw failure;
    }
}

function contentPath(id: string) {
    return `/v1/blog/content?id=${id}`;
}

function day(value: string) {
    return new Date(value).toISOString().split('T')[0];
}

function metaMarkdown(meta: PublicPostMeta & Partial<Awaited<ReturnType<typeof postCounts>>>) {
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

function metaText(meta: PublicPostMeta & Awaited<ReturnType<typeof postCounts>>) {
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
        const row = await requirePost(ctx, params.get('id'));
        const meta = { ...publicPostMeta(row), ...(await postCounts(ctx.db, row.id)) };
        if (output === 'md') return textResponse(metaMarkdown(meta), 'md');
        if (output === 'txt') return textResponse(metaText(meta), 'txt');
        return jsonResponse(meta);
    }

    const output = resolveOutput(params, ctx.request, ['json', 'md'], 'json');
    const limit = parsePositiveInt(params.get('limit'), 20, 100);
    const page = parsePositiveInt(params.get('page'), 1, Number.MAX_SAFE_INTEGER);
    const offset = (page - 1) * limit;

    let query = ctx.db
        .from('db_posts')
        .select(POST_COLUMNS, { count: 'exact' })
        .eq('published', true)
        .order('created_at', { ascending: false })
        .order('public_id');
    const search = escapePostgrestFilter(params.get('query') ?? '');
    if (search) query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    const pastLastPage = error?.code === 'PGRST103';
    if (error && !pastLastPage)
        throw new ApiRequestError(500, 'BLOG_LIST_FETCH_FAILED', 'Could not fetch blog posts.');

    const posts = ((pastLastPage ? [] : (data ?? [])) as unknown as PostRow[]).map(publicPostMeta);
    const total = pastLastPage ? await countPublished(ctx.db, search) : (count ?? posts.length);
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
    const row = await requirePost(ctx, params.get('id'));
    const markdown = await postMarkdown(ctx, row);
    if (output === 'txt') return textResponse(markdownToPlainText(markdown), 'txt');
    if (output === 'json')
        return jsonResponse({
            id: row.public_id,
            slug: row.slug,
            title: row.title,
            content: markdown
        });
    return textResponse(markdown, 'md');
}

export interface CommentRow {
    id: string;
    parent_id: string | null;
    author_name: string | null;
    content: string;
    is_anonymous: boolean | null;
    is_admin: boolean | null;
    created_at: string;
}

export interface PublicComment {
    author_name: string | null;
    content: string;
    is_admin: boolean;
    is_anonymous: boolean;
    created_at: string;
    replies: PublicComment[];
}

function publicAuthorName(row: Pick<CommentRow, 'author_name' | 'is_anonymous'>) {
    return row.is_anonymous ? 'Anonymous' : row.author_name;
}

export function buildCommentTree(rows: readonly CommentRow[]): PublicComment[] {
    const nodes = new Map<string, PublicComment>();
    for (const row of rows)
        nodes.set(row.id, {
            author_name: publicAuthorName(row),
            content: row.content,
            is_admin: !!row.is_admin,
            is_anonymous: !!row.is_anonymous,
            created_at: row.created_at,
            replies: []
        });
    const roots: PublicComment[] = [];
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

    if (params.has('id')) {
        const row = await requirePost(ctx, params.get('id'));
        const { data, error } = await ctx.db
            .from('db_comments')
            .select('id, parent_id, author_name, content, is_anonymous, is_admin, created_at')
            .eq('post_id', row.id)
            .eq('is_approved', true)
            .order('created_at', { ascending: true })
            .order('id')
            .limit(1000);
        if (error)
            throw new ApiRequestError(
                500,
                'BLOG_COMMENTS_FETCH_FAILED',
                'Could not fetch comments.'
            );
        const threads = buildCommentTree((data ?? []) as CommentRow[]);
        return jsonResponse({
            id: row.public_id,
            slug: row.slug,
            data: threads.slice(0, limit),
            hasMore: threads.length > limit
        });
    }

    const { data, error } = await ctx.db
        .from('db_comments')
        .select(
            'parent_id, author_name, content, is_anonymous, is_admin, created_at, post:db_posts!inner(public_id, slug, published)'
        )
        .eq('is_approved', true)
        .eq('post.published', true)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error)
        throw new ApiRequestError(500, 'BLOG_COMMENTS_FETCH_FAILED', 'Could not fetch comments.');

    type RecentRow = Omit<CommentRow, 'id'> & { post: { public_id: string; slug: string } };
    return jsonResponse({
        data: ((data ?? []) as unknown as RecentRow[]).map(row => ({
            post: { id: row.post.public_id, slug: row.post.slug },
            author_name: publicAuthorName(row),
            content: row.content,
            is_admin: !!row.is_admin,
            is_anonymous: !!row.is_anonymous,
            is_reply: !!row.parent_id,
            created_at: row.created_at
        }))
    });
}

export async function getBlogViews(ctx: ApiContext) {
    const params = parseApiParams(ctx.url, ['id']);
    const row = await requirePost(ctx, params.get('id'));
    const { count, error } = await ctx.db
        .from('db_views')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', row.id);
    if (error)
        throw new ApiRequestError(500, 'BLOG_VIEWS_FETCH_FAILED', 'Could not fetch view counts.');
    return jsonResponse({ id: row.public_id, slug: row.slug, views: count ?? 0 });
}

export async function getSearch(ctx: ApiContext) {
    const params = parseApiParams(ctx.url, ['query', 'page', 'limit']);
    const query = params.get('query') ?? '';
    const limit = parsePositiveInt(params.get('limit'), 6, 20);
    const page = parsePositiveInt(params.get('page'), 1, Number.MAX_SAFE_INTEGER);
    const offset = (page - 1) * limit;
    const normalized = escapePostgrestFilter(query);

    if (query.length < 2 || !normalized)
        return jsonResponse({
            query,
            data: [],
            pagination: { page, limit, returned: 0, hasMore: false }
        });

    const { data, error } = await ctx.db
        .from('db_posts')
        .select('public_id, title, slug, excerpt')
        .eq('published', true)
        .or(`title.ilike.%${normalized}%,excerpt.ilike.%${normalized}%`)
        .order('created_at', { ascending: false })
        .order('public_id')
        .range(offset, offset + limit);
    if (error)
        throw new ApiRequestError(500, 'SEARCH_FETCH_FAILED', 'Could not search published posts.');

    const rows = (data ?? []) as Array<{
        public_id: string;
        title: string;
        slug: string;
        excerpt: string | null;
    }>;
    const results = rows
        .slice(0, limit)
        .map(post => ({
            type: 'post' as const,
            id: post.public_id,
            title: post.title,
            subtitle: post.excerpt ?? 'Blog post',
            url: `/blog/${post.slug}`
        }));
    return jsonResponse({
        query,
        data: results,
        pagination: { page, limit, returned: results.length, hasMore: rows.length > limit }
    });
}
