import type { SupabaseClient } from '@supabase/supabase-js';
import { bannerUrl } from '@fkp/domain/blogAssets.ts';
import { parsePostReference } from '@fkp/domain/postReference.ts';
import { isValidPostSlug } from '@fkp/domain/slug.ts';
import {
    publicCommentAuthor,
    type PostStats,
    type PublicComment,
    type RecentComment
} from '@fkp/domain/blog.ts';
import type {
    BlogRepository,
    CommentRepository,
    PostListOptions,
    PostLookup,
    PostPage,
    PostSource,
    PublishedPost,
    PublishedPostWithStats,
    ReadOptions
} from '../blog';
import { DataError } from '../errors';
import { createPostSource, sourceRecord } from '../source';
import { escapeSearchTerm } from './filter';
import { postRenderPath } from './paths';

export interface SupabaseRepositoryOptions {
    fetch?: typeof fetch;
    cdnBase?: string;
}

const BUCKET = 'blog-posts';
const POST_COLUMNS =
    'id, public_id, title, slug, pinned, created_at, updated_at, excerpt, tags, collaborators, summary, tldr, storage_path, banner_version, read_time';
const STATS_COLUMNS = 'view_count, comments:db_comments(count)';
const APPROVED_COMMENTS = 'comments.is_approved';
const COMMENT_COLUMNS =
    'id, public_id, parent_id, author_name, content, is_anonymous, is_admin, created_at';
const PAST_LAST_PAGE = 'PGRST103';

interface PostRow {
    id: string;
    public_id: string;
    title: string | null;
    slug: string | null;
    pinned: boolean | null;
    created_at: string | null;
    updated_at: string | null;
    excerpt: string | null;
    tags: unknown;
    collaborators: unknown;
    summary: string | null;
    tldr: unknown;
    storage_path: string | null;
    banner_version: string | null;
    read_time: number | null;
    comments?: { count: number }[];
    view_count?: number | null;
}

function strings(value: unknown): string[] {
    return Array.isArray(value) ?
            value.filter((item): item is string => typeof item === 'string')
        :   [];
}

function embeddedCount(value: { count: number }[] | undefined): number {
    return value?.[0]?.count ?? 0;
}

export function postFromRow(row: PostRow, cdnBase: string | undefined): PublishedPost {
    const slug = String(row.slug ?? '');
    return {
        id: String(row.public_id),
        title: String(row.title ?? ''),
        slug,
        pinned: row.pinned === true,
        created_at: String(row.created_at ?? ''),
        updated_at: row.updated_at ?? null,
        excerpt: row.excerpt ?? null,
        tags: strings(row.tags),
        collaborators: strings(row.collaborators),
        summary: row.summary ?? null,
        tldr: strings(row.tldr),
        banner_url:
            cdnBase === undefined ? null : (
                bannerUrl(
                    { id: row.id, slug, published: true, banner_version: row.banner_version },
                    cdnBase
                )
            ),
        read_minutes: typeof row.read_time === 'number' && row.read_time > 0 ? row.read_time : null,
        source: createPostSource({ postId: row.id, storagePath: row.storage_path })
    };
}

function withStats(row: PostRow, post: PublishedPost): PublishedPostWithStats {
    return {
        ...post,
        comment_count: embeddedCount(row.comments),
        views_count: row.view_count ?? 0
    };
}

function toComment(row: Record<string, unknown>): PublicComment {
    const isAnonymous = row.is_anonymous === true;
    return {
        id: String(row.id),
        parent_id: typeof row.parent_id === 'string' ? row.parent_id : null,
        author_name: publicCommentAuthor({
            author_name: typeof row.author_name === 'string' ? row.author_name : null,
            is_anonymous: isAnonymous
        }),
        content: String(row.content ?? ''),
        is_anonymous: isAnonymous,
        is_admin: row.is_admin === true,
        created_at: String(row.created_at ?? '')
    };
}

export function createSupabaseBlogRepository(
    db: SupabaseClient,
    options: SupabaseRepositoryOptions = {}
): BlogRepository {
    const fetchFn = options.fetch ?? fetch;

    function published(columns: string, count = false) {
        return db
            .from('db_posts')
            .select(columns, count ? { count: 'exact' } : undefined)
            .eq('published', true);
    }

    async function countPublished(search: string): Promise<number> {
        let query = db
            .from('db_posts')
            .select('public_id', { count: 'exact', head: true })
            .eq('published', true);
        if (search) query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
        const { count, error } = await query;
        if (error) throw new DataError('blog.countPublished', error);
        return count ?? 0;
    }

    async function list(
        columns: string,
        { limit, offset = 0, search = '' }: PostListOptions
    ): Promise<{ rows: PostRow[]; total: number }> {
        const term = escapeSearchTerm(search);
        let query = published(columns, true)
            .order('created_at', { ascending: false })
            .order('public_id');
        if (columns.includes(STATS_COLUMNS)) query = query.eq(APPROVED_COMMENTS, true);
        if (term) query = query.or(`title.ilike.%${term}%,excerpt.ilike.%${term}%`);
        if (limit !== undefined) query = query.range(offset, offset + limit - 1);
        else if (offset) query = query.range(offset, offset + 999);
        const { data, error, count } = await query;
        if (error?.code === PAST_LAST_PAGE) return { rows: [], total: await countPublished(term) };
        if (error) throw new DataError('blog.listPublished', error);
        const rows = (data ?? []) as unknown as PostRow[];
        return { rows, total: count ?? rows.length };
    }

    async function publicText(path: string | null, { timeoutMs }: ReadOptions = {}) {
        if (!path) return null;
        try {
            const { data } = db.storage.from(BUCKET).getPublicUrl(path);
            const response = await fetchFn(
                data.publicUrl,
                timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : undefined
            );
            return response.ok ? await response.text() : null;
        } catch {
            return null;
        }
    }

    return {
        async listPublished(listOptions = {}): Promise<PostPage<PublishedPost>> {
            const { rows, total } = await list(POST_COLUMNS, listOptions);
            return { posts: rows.map(row => postFromRow(row, options.cdnBase)), total };
        },

        async listPublishedWithStats(listOptions = {}): Promise<PostPage<PublishedPostWithStats>> {
            const { rows, total } = await list(`${POST_COLUMNS}, ${STATS_COLUMNS}`, listOptions);
            return {
                posts: rows.map(row => withStats(row, postFromRow(row, options.cdnBase))),
                total
            };
        },

        async findPublished(reference: string): Promise<PostLookup<PublishedPost>> {
            const parsed = parsePostReference(reference);
            if (!parsed) return { status: 'invalid' };
            const attempts: Array<() => PromiseLike<{ data: unknown; error: unknown }>> = [];
            if (parsed.publicId)
                attempts.push(() =>
                    published(POST_COLUMNS).eq('public_id', parsed.publicId!).limit(2)
                );
            if (parsed.slug)
                attempts.push(() => published(POST_COLUMNS).eq('slug', parsed.slug!).limit(2));
            if (parsed.prefix)
                attempts.push(() =>
                    published(POST_COLUMNS).like('public_id', `${parsed.prefix}%`).limit(2)
                );
            for (const attempt of attempts) {
                const { data, error } = await attempt();
                if (error) throw new DataError('blog.findPublished', error);
                const rows = (data ?? []) as PostRow[];
                if (rows.length > 1) return { status: 'ambiguous' };
                if (rows.length === 1)
                    return { status: 'found', post: postFromRow(rows[0], options.cdnBase) };
            }
            return { status: 'not-found' };
        },

        async getPublishedBySlug(slug: string): Promise<PublishedPost | null> {
            if (!isValidPostSlug(slug)) return null;
            const { data, error } = await published(POST_COLUMNS).eq('slug', slug).maybeSingle();
            if (error) throw new DataError('blog.getPublishedBySlug', error);
            return data ? postFromRow(data as unknown as PostRow, options.cdnBase) : null;
        },

        async postStats(post: PublishedPost): Promise<PostStats> {
            const { postId } = sourceRecord(post.source);
            const { data, error } = await db
                .from('db_posts')
                .select(STATS_COLUMNS)
                .eq('id', postId)
                .eq(APPROVED_COMMENTS, true)
                .maybeSingle();
            if (error) throw new DataError('blog.postStats', error);
            const row = (data ?? {}) as Pick<PostRow, 'comments' | 'view_count'>;
            return { comment_count: embeddedCount(row.comments), views_count: row.view_count ?? 0 };
        },

        readMarkdown(source: PostSource, readOptions?: ReadOptions) {
            return publicText(sourceRecord(source).storagePath, readOptions);
        },

        readRender(source: PostSource, readOptions?: ReadOptions) {
            return publicText(postRenderPath(sourceRecord(source).storagePath), readOptions);
        }
    };
}

export function createSupabaseCommentRepository(db: SupabaseClient): CommentRepository {
    return {
        async listApproved(post: PublishedPost): Promise<PublicComment[]> {
            const { postId } = sourceRecord(post.source);
            const { data, error } = await db
                .from('db_comments')
                .select(COMMENT_COLUMNS)
                .eq('post_id', postId)
                .eq('is_approved', true)
                .order('created_at', { ascending: true })
                .order('id')
                .limit(1000);
            if (error) throw new DataError('comments.listApproved', error);
            const rows = (data ?? []) as Record<string, unknown>[];
            const publicIds = new Map(rows.map(row => [String(row.id), String(row.public_id)]));
            return rows.map(row =>
                toComment({
                    ...row,
                    id: row.public_id,
                    parent_id:
                        typeof row.parent_id === 'string' ?
                            (publicIds.get(row.parent_id) ?? null)
                        :   null
                })
            );
        },

        async listRecentApproved(limit: number): Promise<RecentComment[]> {
            const { data, error } = await db
                .from('db_comments')
                .select(
                    'parent_id, author_name, content, is_anonymous, is_admin, created_at, post:db_posts!inner(public_id, slug, published)'
                )
                .eq('is_approved', true)
                .eq('post.published', true)
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error) throw new DataError('comments.listRecentApproved', error);
            type Row = Record<string, unknown> & { post: { public_id: string; slug: string } };
            return ((data ?? []) as unknown as Row[]).map(row => {
                const comment = toComment({ ...row, id: '' });
                return {
                    post: { id: row.post.public_id, slug: row.post.slug },
                    author_name: comment.author_name,
                    content: comment.content,
                    is_anonymous: comment.is_anonymous,
                    is_admin: comment.is_admin,
                    is_reply: comment.parent_id !== null,
                    created_at: comment.created_at
                };
            });
        }
    };
}
