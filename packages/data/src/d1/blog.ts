import { bannerUrl } from '@idstead/domain/blogAssets.ts';
import { parsePostReference } from '@idstead/domain/postReference.ts';
import { isValidPostSlug } from '@idstead/domain/slug.ts';
import {
    publicCommentAuthor,
    type PostStats,
    type PublicComment,
    type RecentComment
} from '@idstead/domain/blog.ts';
import type {
    BlogRepository,
    CommentRepository,
    PostListOptions,
    PostLookup,
    PostPage,
    PostRenderStore,
    PostSource,
    PublishedPost,
    PublishedPostWithStats
} from '../blog';
import { DataError } from '../errors';
import { createPostSource, sourceRecord } from '../source';
import { postRenderPath } from '../supabase/paths';
import {
    contentKey,
    flag,
    jsonStrings,
    likePattern,
    readContent,
    type ContentBucket,
    type D1Like,
    type D1Row
} from './client';

export interface D1RepositoryOptions {
    cdnBase?: string;
}

const POST_COLUMNS =
    'p.id, p.public_id, p.title, p.slug, p.pinned, p.created_at, p.updated_at, p.excerpt, p.tags, p.collaborators, p.summary, p.tldr, p.storage_path, p.banner_version, p.read_time';
const STATS_COLUMNS =
    '(SELECT count(*) FROM db_comments c WHERE c.post_id = p.id AND c.is_approved = 1) AS comment_count, coalesce((SELECT s.view_count FROM db_post_stats s WHERE s.post_id = p.id), 0) AS view_count';
const SEARCH = "(p.title LIKE ?1 ESCAPE '\\' OR p.excerpt LIKE ?1 ESCAPE '\\')";

function postFromRow(row: D1Row, cdnBase: string | undefined): PublishedPost {
    const slug = String(row.slug ?? '');
    const id = String(row.id);
    return {
        id: String(row.public_id),
        title: String(row.title ?? ''),
        slug,
        pinned: flag(row.pinned),
        created_at: String(row.created_at ?? ''),
        updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
        excerpt: typeof row.excerpt === 'string' ? row.excerpt : null,
        tags: jsonStrings(row.tags),
        collaborators: jsonStrings(row.collaborators),
        summary: typeof row.summary === 'string' ? row.summary : null,
        tldr: jsonStrings(row.tldr),
        banner_url:
            cdnBase === undefined ? null : (
                bannerUrl(
                    {
                        id,
                        slug,
                        published: true,
                        banner_version:
                            typeof row.banner_version === 'string' ? row.banner_version : null
                    },
                    cdnBase
                )
            ),
        read_minutes: typeof row.read_time === 'number' && row.read_time > 0 ? row.read_time : null,
        source: createPostSource({
            postId: id,
            storagePath: typeof row.storage_path === 'string' ? row.storage_path : null
        })
    };
}

function stats(row: D1Row): PostStats {
    return {
        comment_count: Number(row.comment_count ?? 0),
        views_count: Number(row.view_count ?? 0)
    };
}

function toComment(row: D1Row): PublicComment {
    const isAnonymous = flag(row.is_anonymous);
    return {
        id: String(row.id),
        parent_id: typeof row.parent_id === 'string' ? row.parent_id : null,
        author_name: publicCommentAuthor({
            author_name: typeof row.author_name === 'string' ? row.author_name : null,
            is_anonymous: isAnonymous
        }),
        content: String(row.content ?? ''),
        is_anonymous: isAnonymous,
        is_admin: flag(row.is_admin),
        created_at: String(row.created_at ?? '')
    };
}

export function createD1BlogRepository(
    db: D1Like,
    bucket: ContentBucket,
    options: D1RepositoryOptions = {}
): BlogRepository {
    async function list(columns: string, { limit, offset = 0, search = '' }: PostListOptions) {
        const term = search.trim();
        const where = `p.published = 1${term ? ` AND ${SEARCH}` : ''}`;
        const params = term ? [likePattern(term)] : [];
        const window =
            limit !== undefined ? ` LIMIT ${Math.max(0, limit)} OFFSET ${Math.max(0, offset)}`
            : offset ? ` LIMIT -1 OFFSET ${Math.max(0, offset)}`
            : '';
        try {
            const [rows, count] = await db.batch([
                db
                    .prepare(
                        `SELECT ${columns} FROM db_posts p WHERE ${where} ORDER BY p.created_at DESC, p.public_id${window}`
                    )
                    .bind(...params),
                db
                    .prepare(`SELECT count(*) AS total FROM db_posts p WHERE ${where}`)
                    .bind(...params)
            ]);
            return { rows: rows.results, total: Number(count.results[0]?.total ?? 0) };
        } catch (error) {
            throw new DataError('blog.listPublished', error);
        }
    }

    async function publishedWhere(condition: string, value: string, limit: number) {
        try {
            const { results } = await db
                .prepare(
                    `SELECT ${POST_COLUMNS} FROM db_posts p WHERE p.published = 1 AND ${condition} LIMIT ${limit}`
                )
                .bind(value)
                .all();
            return results;
        } catch (error) {
            throw new DataError('blog.findPublished', error);
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
                posts: rows.map(row => ({ ...postFromRow(row, options.cdnBase), ...stats(row) })),
                total
            };
        },

        async findPublished(reference: string): Promise<PostLookup<PublishedPost>> {
            const parsed = parsePostReference(reference);
            if (!parsed) return { status: 'invalid' };
            const attempts: Array<[string, string]> = [];
            if (parsed.publicId) attempts.push(['p.public_id = ?1', parsed.publicId]);
            if (parsed.slug) attempts.push(['p.slug = ?1', parsed.slug]);
            if (parsed.prefix) attempts.push(['p.public_id LIKE ?1', `${parsed.prefix}%`]);
            for (const [condition, value] of attempts) {
                const rows = await publishedWhere(condition, value, 2);
                if (rows.length > 1) return { status: 'ambiguous' };
                if (rows.length === 1)
                    return { status: 'found', post: postFromRow(rows[0], options.cdnBase) };
            }
            return { status: 'not-found' };
        },

        async getPublishedBySlug(slug: string): Promise<PublishedPost | null> {
            if (!isValidPostSlug(slug)) return null;
            const [row] = await publishedWhere('p.slug = ?1', slug, 1);
            return row ? postFromRow(row, options.cdnBase) : null;
        },

        async postStats(post: PublishedPost): Promise<PostStats> {
            const { postId } = sourceRecord(post.source);
            try {
                const row = await db
                    .prepare(`SELECT ${STATS_COLUMNS} FROM db_posts p WHERE p.id = ?1`)
                    .bind(postId)
                    .first();
                return row ? stats(row) : { comment_count: 0, views_count: 0 };
            } catch (error) {
                throw new DataError('blog.postStats', error);
            }
        },

        readMarkdown(source: PostSource, readOptions = {}) {
            return readContent(bucket, sourceRecord(source).storagePath, readOptions.timeoutMs);
        },

        readRender(source: PostSource, readOptions = {}) {
            return readContent(
                bucket,
                postRenderPath(sourceRecord(source).storagePath),
                readOptions.timeoutMs
            );
        }
    };
}

export function createD1CommentRepository(db: D1Like): CommentRepository {
    return {
        async listApproved(post: PublishedPost): Promise<PublicComment[]> {
            const { postId } = sourceRecord(post.source);
            try {
                const { results } = await db
                    .prepare(
                        `SELECT c.public_id AS id, parent.public_id AS parent_id, c.author_name, c.content, c.is_anonymous, c.is_admin, c.created_at
                         FROM db_comments c LEFT JOIN db_comments parent ON parent.id = c.parent_id AND parent.is_approved = 1
                         WHERE c.post_id = ?1 AND c.is_approved = 1
                         ORDER BY c.created_at, c.id LIMIT 1000`
                    )
                    .bind(postId)
                    .all();
                return results.map(toComment);
            } catch (error) {
                throw new DataError('comments.listApproved', error);
            }
        },

        async listRecentApproved(limit: number): Promise<RecentComment[]> {
            try {
                const { results } = await db
                    .prepare(
                        `SELECT c.parent_id, c.author_name, c.content, c.is_anonymous, c.is_admin, c.created_at, p.public_id AS post_public_id, p.slug AS post_slug
                         FROM db_comments c JOIN db_posts p ON p.id = c.post_id
                         WHERE c.is_approved = 1 AND p.published = 1
                         ORDER BY c.created_at DESC LIMIT ?1`
                    )
                    .bind(Math.max(0, limit))
                    .all();
                return results.map(row => {
                    const comment = toComment({ ...row, id: '' });
                    return {
                        post: { id: String(row.post_public_id), slug: String(row.post_slug) },
                        author_name: comment.author_name,
                        content: comment.content,
                        is_anonymous: comment.is_anonymous,
                        is_admin: comment.is_admin,
                        is_reply: comment.parent_id !== null,
                        created_at: comment.created_at
                    };
                });
            } catch (error) {
                throw new DataError('comments.listRecentApproved', error);
            }
        }
    };
}

export function createD1RenderStore(db: D1Like, bucket: ContentBucket): PostRenderStore {
    return {
        async listRenderCandidates(limit: number): Promise<PostSource[]> {
            try {
                const { results } = await db
                    .prepare(
                        'SELECT id, storage_path FROM db_posts WHERE published = 1 ORDER BY created_at DESC LIMIT ?1'
                    )
                    .bind(Math.max(0, limit))
                    .all<{ id: string; storage_path: string | null }>();
                return results
                    .filter(row => postRenderPath(row.storage_path) !== null)
                    .map(row =>
                        createPostSource({ postId: row.id, storagePath: row.storage_path })
                    );
            } catch (error) {
                throw new DataError('renders.listRenderCandidates', error);
            }
        },

        downloadMarkdown(source: PostSource) {
            return readContent(bucket, sourceRecord(source).storagePath);
        },

        downloadRender(source: PostSource) {
            return readContent(bucket, postRenderPath(sourceRecord(source).storagePath));
        },

        async writeRender(source: PostSource, render: string): Promise<void> {
            const path = postRenderPath(sourceRecord(source).storagePath);
            if (!path) throw new DataError('renders.writeRender', 'The post has no render path.');
            try {
                await bucket.put(contentKey(path), render, {
                    httpMetadata: { contentType: 'application/json' }
                });
            } catch (error) {
                throw new DataError('renders.writeRender', error);
            }
        },

        renderPath(source: PostSource) {
            return postRenderPath(sourceRecord(source).storagePath);
        }
    };
}
