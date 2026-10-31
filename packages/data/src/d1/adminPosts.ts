// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type {
    AdminPost,
    AdminPostDraft,
    AdminPostStore,
    BannerCleanup,
    MarkdownCleanup,
    PostAssetState,
    PostCleanupStore,
    PostFlags,
    PostFlagsUpdate,
    PostOperation,
    PostOperationPreparation,
    PostOperationRequest,
    PostOperationStore
} from '../adminPosts';
import { storedBannerCredit, storedPostLicense } from '@idstead/domain/contentLicense.ts';
import { DataError } from '../errors';
import { postMarkdownPath, postRenderPath } from '../paths';
import {
    contentKey,
    flag,
    jsonStrings,
    readContent,
    type ContentBucket,
    type D1Like,
    type D1Row,
    type D1Statement
} from './client';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
const STALE = 'post-operation-stale';
const CONSTRAINT =
    /constraint failed|Excerpt is required|Tags allow|public_id is immutable|Referenced banner is unavailable/i;

function assetState(row: D1Row): PostAssetState {
    return {
        id: String(row.id),
        slug: String(row.slug),
        published: flag(row.published),
        banner_version: typeof row.banner_version === 'string' ? row.banner_version : null
    };
}

function errorText(error: unknown): string {
    if (error instanceof Error) return `${error.message} ${errorText(error.cause)}`;
    return typeof error === 'string' ? error : '';
}

function parseJson(value: unknown): unknown {
    if (typeof value !== 'string') return value ?? null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function operationFromRow(row: D1Row): PostOperation & Record<string, unknown> {
    return {
        ...row,
        id: String(row.id),
        state: row.state as PostOperation['state'],
        post_data: parseJson(row.post_data),
        result: parseJson(row.result) as PostOperation['result']
    };
}

export function createD1AdminPostStore(db: D1Like, bucket: ContentBucket): AdminPostStore {
    async function guarded<T>(operation: string, task: () => Promise<T>): Promise<T> {
        try {
            return await task();
        } catch (error) {
            throw error instanceof DataError ? error : new DataError(operation, error);
        }
    }

    return {
        list: () =>
            guarded('adminPosts.list', async () => {
                const { results } = await db
                    .prepare(
                        `SELECT p.*, coalesce(s.view_count, 0) AS view_count, coalesce(s.helpful_yes, 0) AS helpful_yes,
                             coalesce(s.helpful_no, 0) AS helpful_no,
                             (SELECT count(*) FROM db_comments c WHERE c.post_id = p.id) AS comment_count
                         FROM db_posts p LEFT JOIN db_post_stats s ON s.post_id = p.id
                         ORDER BY p.created_at DESC`
                    )
                    .all();
                return results.map((row): AdminPost => ({
                    id: String(row.id),
                    title: String(row.title),
                    slug: String(row.slug),
                    published: flag(row.published),
                    pinned: flag(row.pinned),
                    storage_path: typeof row.storage_path === 'string' ? row.storage_path : null,
                    created_at: String(row.created_at),
                    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
                    banner_version:
                        typeof row.banner_version === 'string' ? row.banner_version : null,
                    post_revision: Number(row.post_revision),
                    excerpt: typeof row.excerpt === 'string' ? row.excerpt : null,
                    tags: jsonStrings(row.tags),
                    helpful_yes: Number(row.helpful_yes),
                    helpful_no: Number(row.helpful_no),
                    read_minutes:
                        typeof row.read_time === 'number' && row.read_time > 0 ?
                            row.read_time
                        :   null,
                    views_count: Number(row.view_count),
                    comment_count: Number(row.comment_count)
                }));
            }),

        get: (id: string) =>
            guarded('adminPosts.get', async (): Promise<AdminPostDraft | null> => {
                const row = await db
                    .prepare('SELECT * FROM db_posts WHERE id = ?1')
                    .bind(id)
                    .first();
                if (!row) return null;
                let markdown: string | null = null;
                if (typeof row.storage_path === 'string') {
                    markdown = await readContent(bucket, row.storage_path);
                    if (markdown === null)
                        throw new DataError(
                            'adminPosts.get.markdown',
                            'The markdown file is missing.'
                        );
                }
                return {
                    id: String(row.id),
                    title: String(row.title),
                    slug: String(row.slug),
                    published: flag(row.published),
                    banner_version:
                        typeof row.banner_version === 'string' ? row.banner_version : null,
                    post_revision: Number(row.post_revision),
                    excerpt: typeof row.excerpt === 'string' ? row.excerpt : null,
                    tags: jsonStrings(row.tags),
                    collaborators: jsonStrings(row.collaborators),
                    content_license: storedPostLicense(row.content_license),
                    banner_credit: storedBannerCredit(row.banner_credit),
                    markdown
                };
            }),

        assetState: (id: string) =>
            guarded('adminPosts.assetState', async () => {
                const row = await db
                    .prepare(
                        'SELECT id, slug, published, banner_version FROM db_posts WHERE id = ?1'
                    )
                    .bind(id)
                    .first();
                return row ? assetState(row) : null;
            }),

        slugTaken: (slug: string, exceptId: string) =>
            guarded('adminPosts.slugTaken', async () =>
                Boolean(
                    await db
                        .prepare(
                            'SELECT 1 AS taken FROM db_posts WHERE slug = ?1 AND id <> ?2 LIMIT 1'
                        )
                        .bind(slug, exceptId)
                        .first()
                )
            ),

        exists: (id: string) =>
            guarded('adminPosts.exists', async () =>
                Boolean(
                    await db
                        .prepare('SELECT 1 AS found FROM db_posts WHERE id = ?1')
                        .bind(id)
                        .first()
                )
            ),

        async setFlags(id: string, flags: PostFlags): Promise<PostFlagsUpdate> {
            const sets: string[] = [];
            const values: unknown[] = [id];
            for (const key of ['published', 'pinned'] as const)
                if (typeof flags[key] === 'boolean') {
                    values.push(flags[key] ? 1 : 0);
                    sets.push(`${key} = ?${values.length}`);
                }
            if (!sets.length) throw new DataError('adminPosts.setFlags', 'No flags to update.');
            try {
                const [, read] = await db.batch([
                    db
                        .prepare(`UPDATE db_posts SET ${sets.join(', ')} WHERE id = ?1`)
                        .bind(...values),
                    db
                        .prepare(
                            'SELECT id, slug, published, banner_version, pinned, post_revision FROM db_posts WHERE id = ?1'
                        )
                        .bind(id)
                ]);
                const row = read.results[0];
                if (!row) return { status: 'not-found' };
                return {
                    status: 'updated',
                    post: {
                        ...assetState(row),
                        pinned: flag(row.pinned),
                        post_revision: Number(row.post_revision)
                    }
                };
            } catch (error) {
                const message = errorText(error);
                if (message.includes('Excerpt is required')) return { status: 'excerpt-required' };
                if (message.includes('Maximum of 3 pinned posts')) return { status: 'pin-limit' };
                throw new DataError('adminPosts.setFlags', error);
            }
        }
    };
}

function arrayJson(value: unknown): string {
    return JSON.stringify(
        Array.isArray(value) ? value.filter(item => typeof item === 'string') : []
    );
}

export function createD1PostOperationStore(db: D1Like, bucket: ContentBucket): PostOperationStore {
    async function readOperation(id: string, actor?: string) {
        const row = await db
            .prepare(
                `SELECT * FROM db_post_operations WHERE id = ?1${actor === undefined ? '' : ' AND actor_id = ?2'}`
            )
            .bind(...(actor === undefined ? [id] : [id, actor]))
            .first();
        return row ? operationFromRow(row) : null;
    }

    async function reject(op: PostOperation & Record<string, unknown>, actor: string) {
        const statements: D1Statement[] = [
            db
                .prepare(
                    `UPDATE db_post_operations SET state = 'rejected' WHERE id = ?1 AND actor_id = ?2 AND state = 'ready'`
                )
                .bind(op.id, actor),
            db
                .prepare(
                    `UPDATE db_blog_banner_versions SET state = 'retired', retired_at = ${NOW} WHERE id = ?1 AND state = 'pending'`
                )
                .bind(op.id)
        ];
        if (op.kind === 'save')
            statements.push(
                db
                    .prepare(
                        'INSERT INTO db_post_storage_cleanup (storage_path, post_id) VALUES (?1, ?2) ON CONFLICT DO NOTHING'
                    )
                    .bind(postMarkdownPath(String(op.post_id), op.id), op.post_id)
            );
        await db.batch(statements);
        return (await readOperation(op.id))!;
    }

    async function commit(
        operationId: string,
        actor: string,
        attempt: number
    ): Promise<PostOperation> {
        const op = await readOperation(operationId, actor);
        if (!op) throw new DataError('postOperations.commit', 'Unknown operation');
        if (['committed', 'conflict', 'rejected'].includes(op.state)) return op;
        if (op.state !== 'ready')
            throw new DataError('postOperations.commit', 'Upload not confirmed');
        const postId = String(op.post_id);
        const current = await db
            .prepare('SELECT * FROM db_posts WHERE id = ?1')
            .bind(postId)
            .first();
        const expected = op.expected_revision === null ? null : Number(op.expected_revision);
        if (
            (expected === null && current)
            || (expected !== null && (!current || Number(current.post_revision) !== expected))
        ) {
            const statements: D1Statement[] = [
                db
                    .prepare(
                        `UPDATE db_post_operations SET state = 'conflict' WHERE id = ?1 AND state = 'ready'`
                    )
                    .bind(op.id),
                db
                    .prepare(
                        `UPDATE db_blog_banner_versions SET state = 'retired', retired_at = ${NOW} WHERE id = ?1 AND state = 'pending'`
                    )
                    .bind(op.id)
            ];
            if (op.kind === 'save')
                statements.push(
                    db
                        .prepare(
                            'INSERT INTO db_post_storage_cleanup (storage_path, post_id) VALUES (?1, ?2) ON CONFLICT DO NOTHING'
                        )
                        .bind(postMarkdownPath(postId, op.id), postId)
                );
            await db.batch(statements);
            return (await readOperation(op.id))!;
        }
        const guard = db
            .prepare(
                `SELECT json(CASE WHEN EXISTS (SELECT 1 FROM db_post_operations WHERE id = ?1 AND state = 'ready')
                     AND ${current ? 'EXISTS (SELECT 1 FROM db_posts WHERE id = ?2 AND post_revision = ?3)' : 'NOT EXISTS (SELECT 1 FROM db_posts WHERE id = ?2) AND ?3 IS NULL'}
                     THEN '0' ELSE '${STALE}' END) AS ok`
            )
            .bind(op.id, postId, current ? Number(current.post_revision) : null);
        const statements: D1Statement[] = [guard];
        const data = (op.post_data ?? {}) as Record<string, unknown>;
        const currentVersion =
            current && typeof current.banner_version === 'string' ? current.banner_version : null;
        if (op.kind === 'delete') {
            statements.push(
                db.prepare('DELETE FROM db_posts WHERE id = ?1').bind(postId),
                db
                    .prepare(
                        `UPDATE db_blog_banner_versions SET state = 'retired', retired_at = ${NOW} WHERE id = ?1 AND state = 'active'`
                    )
                    .bind(currentVersion),
                db
                    .prepare(
                        `UPDATE db_post_operations SET state = 'committed', committed_at = ${NOW}, result = json_object('id', ?2, 'deleted', json('true')) WHERE id = ?1`
                    )
                    .bind(op.id, postId)
            );
        } else {
            const version =
                op.banner_operation === 'keep' ? currentVersion
                : op.banner_operation === 'replace' ? op.id
                : null;
            if (op.banner_operation === 'replace') {
                const pending = await db
                    .prepare(
                        `SELECT 1 AS found FROM db_blog_banner_versions WHERE id = ?1 AND post_id = ?2 AND state = 'pending'`
                    )
                    .bind(version, postId)
                    .first();
                if (!pending)
                    throw new DataError('postOperations.commit', 'Banner version unavailable');
            }
            const references =
                Array.isArray(data.banner_references) ? data.banner_references.map(String) : [];
            if (references.length) {
                const { results } = await db
                    .prepare(
                        `SELECT count(*) AS available FROM db_blog_banner_versions
                         WHERE id IN (SELECT value FROM json_each(?1)) AND state IN ('active', 'retired', 'staged')`
                    )
                    .bind(JSON.stringify([...new Set(references)]))
                    .all();
                if (Number(results[0]?.available ?? 0) !== new Set(references).size)
                    return reject(op, actor);
            }
            const markdown = postMarkdownPath(postId, op.id);
            const readTime = typeof data.read_time === 'number' ? Math.trunc(data.read_time) : null;
            const text = (key: string) => (typeof data[key] === 'string' ? data[key] : null);
            const contentLicense = storedPostLicense(data.content_license);
            const credit = storedBannerCredit(data.banner_credit);
            const bannerCredit = credit ? JSON.stringify(credit) : null;
            if (!current)
                statements.push(
                    db
                        .prepare(
                            `INSERT INTO db_posts (id, title, slug, excerpt, tags, collaborators, published, storage_path, banner_version, read_time, content_license, banner_credit, post_revision)
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 1)`
                        )
                        .bind(
                            postId,
                            text('title'),
                            text('slug'),
                            text('excerpt'),
                            arrayJson(data.tags),
                            arrayJson(data.collaborators),
                            data.published === true || data.published === 'true' ? 1 : 0,
                            markdown,
                            version,
                            readTime,
                            contentLicense,
                            bannerCredit
                        )
                );
            else
                statements.push(
                    db
                        .prepare(
                            `UPDATE db_posts SET title = ?2, slug = ?3, excerpt = ?4, tags = ?5, collaborators = ?6, published = ?7,
                                 storage_path = ?8, banner_version = ?9,
                                 banner_path = CASE WHEN ?10 = 'keep' THEN banner_path END,
                                 read_time = coalesce(?11, read_time),
                                 content_license = ?12, banner_credit = ?13,
                                 updated_at = ${NOW}
                             WHERE id = ?1`
                        )
                        .bind(
                            postId,
                            text('title'),
                            text('slug'),
                            text('excerpt'),
                            arrayJson(data.tags),
                            arrayJson(data.collaborators),
                            data.published === true || data.published === 'true' ? 1 : 0,
                            markdown,
                            version,
                            op.banner_operation,
                            readTime,
                            contentLicense,
                            bannerCredit
                        )
                );
            statements.push(
                db.prepare('DELETE FROM db_blog_banner_references WHERE post_id = ?1').bind(postId),
                db
                    .prepare(
                        'INSERT INTO db_blog_banner_references (post_id, version_id) SELECT DISTINCT ?1, value FROM json_each(?2)'
                    )
                    .bind(postId, JSON.stringify(references))
            );
            if (version !== currentVersion)
                statements.push(
                    db
                        .prepare(
                            `UPDATE db_blog_banner_versions SET state = 'retired', retired_at = ${NOW} WHERE id = ?1 AND state = 'active'`
                        )
                        .bind(currentVersion),
                    db
                        .prepare(
                            `UPDATE db_blog_banner_versions SET state = 'active' WHERE id = ?1 AND state = 'pending'`
                        )
                        .bind(version)
                );
            statements.push(
                db
                    .prepare(
                        `UPDATE db_post_operations SET state = 'committed', committed_at = ${NOW},
                             result = (SELECT json_object('id', id, 'post_revision', post_revision, 'banner_version', banner_version,
                                 'slug', slug, 'published', json(CASE WHEN published = 1 THEN 'true' ELSE 'false' END))
                             FROM db_posts WHERE id = ?2)
                         WHERE id = ?1`
                    )
                    .bind(op.id, postId)
            );
        }
        if (current && typeof current.storage_path === 'string')
            statements.splice(
                statements.length - 1,
                0,
                db
                    .prepare(
                        'INSERT INTO db_post_storage_cleanup (storage_path, post_id) VALUES (?1, ?2) ON CONFLICT DO NOTHING'
                    )
                    .bind(current.storage_path, postId)
            );
        try {
            await db.batch(statements);
        } catch (error) {
            const message = errorText(error);
            if (message.includes('malformed JSON') && attempt < 2)
                return commit(operationId, actor, attempt + 1);
            if (CONSTRAINT.test(message)) return reject(op, actor);
            throw new DataError('postOperations.commit', error);
        }
        return (await readOperation(op.id))!;
    }

    return {
        async prepare(request: PostOperationRequest): Promise<PostOperationPreparation> {
            if (
                !request.actor
                || !['save', 'delete'].includes(request.kind)
                || !['keep', 'replace', 'remove'].includes(String(request.banner.operation))
            )
                throw new DataError('postOperations.prepare', 'Invalid post operation');
            try {
                const createdAt = new Date().toISOString();
                const bytes = Number(request.banner.bytes);
                await db.batch([
                    db
                        .prepare(
                            `INSERT INTO db_post_operations (id, actor_id, post_id, request_hash, expected_revision, kind, post_data, banner_operation, created_at)
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) ON CONFLICT (id) DO NOTHING`
                        )
                        .bind(
                            request.operationId,
                            request.actor,
                            request.postId,
                            request.hash,
                            request.revision,
                            request.kind,
                            JSON.stringify(request.post),
                            request.banner.operation,
                            createdAt
                        ),
                    db
                        .prepare(
                            `UPDATE db_post_operations SET state = 'conflict'
                             WHERE id = ?1 AND created_at = ?2 AND state = 'pending' AND (
                                 (?3 IS NULL AND (EXISTS (SELECT 1 FROM db_posts WHERE id = ?4) OR ?5 = 'delete'))
                                 OR (?3 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM db_posts WHERE id = ?4 AND post_revision = ?3))
                             )`
                        )
                        .bind(
                            request.operationId,
                            createdAt,
                            request.revision,
                            request.postId,
                            request.kind
                        ),
                    db
                        .prepare(
                            `INSERT INTO db_blog_banner_versions (id, post_id, object_key, sha256, bytes)
                             SELECT ?1, ?2, 'blog/banners/' || ?2 || '/' || ?1 || '.webp', ?3, ?4
                             WHERE ?5 = 'save' AND ?6 = 'replace' AND EXISTS (
                                 SELECT 1 FROM db_post_operations WHERE id = ?1 AND created_at = ?7 AND state = 'pending'
                             )`
                        )
                        .bind(
                            request.operationId,
                            request.postId,
                            typeof request.banner.sha256 === 'string' ?
                                request.banner.sha256
                            :   null,
                            Number.isFinite(bytes) ? Math.trunc(bytes) : null,
                            request.kind,
                            request.banner.operation,
                            createdAt
                        )
                ]);
                const op = await readOperation(request.operationId);
                if (!op)
                    throw new DataError('postOperations.prepare', 'The operation was not stored.');
                if (op.actor_id !== request.actor || op.request_hash !== request.hash)
                    return { status: 'reused' };
                return { status: 'prepared', operation: op };
            } catch (error) {
                throw error instanceof DataError ? error : (
                        new DataError('postOperations.prepare', error)
                    );
            }
        },

        async revision(postId: string) {
            try {
                const row = await db
                    .prepare('SELECT banner_version, post_revision FROM db_posts WHERE id = ?1')
                    .bind(postId)
                    .first<{ banner_version: string | null; post_revision: number }>();
                return row ?? null;
            } catch (error) {
                throw new DataError('postOperations.revision', error);
            }
        },

        async writeMarkdown(postId: string, operationId: string, markdown: string) {
            const key = contentKey(postMarkdownPath(postId, operationId));
            try {
                const existing = await bucket.get(key);
                if (existing) {
                    if ((await existing.text()) !== markdown)
                        throw new DataError(
                            'postOperations.writeMarkdown',
                            'A different file already exists.'
                        );
                    return;
                }
                await bucket.put(key, markdown, { httpMetadata: { contentType: 'text/markdown' } });
            } catch (error) {
                throw error instanceof DataError ? error : (
                        new DataError('postOperations.writeMarkdown', error)
                    );
            }
        },

        async writeRender(postId: string, operationId: string, render: string) {
            const path = postRenderPath(postMarkdownPath(postId, operationId));
            if (!path) throw new DataError('postOperations.writeRender', 'Invalid render path.');
            try {
                await bucket.put(contentKey(path), render, {
                    httpMetadata: { contentType: 'application/json' }
                });
            } catch (error) {
                throw new DataError('postOperations.writeRender', error);
            }
        },

        async ready(operationId: string, actor: string) {
            try {
                await db
                    .prepare(
                        `UPDATE db_post_operations SET state = 'ready' WHERE id = ?1 AND actor_id = ?2 AND state = 'pending'`
                    )
                    .bind(operationId, actor)
                    .run();
            } catch (error) {
                throw new DataError('postOperations.ready', error);
            }
        },

        commit: (operationId: string, actor: string) => commit(operationId, actor, 0),

        async find(operationId: string, actor: string) {
            try {
                const op = await readOperation(operationId, actor);
                return op ? { id: op.id, state: op.state, result: op.result } : null;
            } catch (error) {
                throw new DataError('postOperations.find', error);
            }
        }
    };
}

export function createD1PostCleanupStore(db: D1Like, bucket: ContentBucket): PostCleanupStore {
    async function run(operation: string, statement: D1Statement) {
        try {
            await statement.run();
        } catch (error) {
            throw new DataError(operation, error);
        }
    }

    return {
        async claimBanners(): Promise<BannerCleanup[]> {
            try {
                const { results } = await db
                    .prepare(
                        `UPDATE db_blog_banner_versions SET state = 'cleaning', cleanup_attempts = cleanup_attempts + 1
                         WHERE id IN (
                             SELECT candidate.id FROM db_blog_banner_versions candidate
                             WHERE candidate.state IN ('retired', 'cleaning') AND candidate.retain = 0
                                 AND candidate.retired_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-24 hours')
                                 AND NOT EXISTS (SELECT 1 FROM db_posts p WHERE p.banner_version = candidate.id)
                                 AND NOT EXISTS (SELECT 1 FROM db_blog_banner_references r WHERE r.version_id = candidate.id)
                                 AND NOT EXISTS (SELECT 1 FROM db_post_operations op WHERE op.id = candidate.id AND op.state IN ('pending', 'ready'))
                             ORDER BY candidate.retired_at LIMIT 20
                         )
                         RETURNING *`
                    )
                    .all();
                return results.map(
                    row => ({ ...row, retain: flag(row.retain) }) as unknown as BannerCleanup
                );
            } catch (error) {
                throw new DataError('postCleanup.claimBanners', error);
            }
        },

        bannerRemoved: (id: string) =>
            run(
                'postCleanup.bannerRemoved',
                db
                    .prepare(
                        `UPDATE db_blog_banner_versions SET state = 'deleted', cleanup_error = NULL WHERE id = ?1 AND state = 'cleaning'`
                    )
                    .bind(id)
            ),

        bannerFailed: (id: string) =>
            run(
                'postCleanup.bannerFailed',
                db
                    .prepare(
                        `UPDATE db_blog_banner_versions SET cleanup_error = 'R2 cleanup failed; retry required.' WHERE id = ?1`
                    )
                    .bind(id)
            ),

        async pendingMarkdown(olderThan: Date, limit: number): Promise<MarkdownCleanup[]> {
            try {
                const { results } = await db
                    .prepare(
                        'SELECT storage_path, cleanup_attempts FROM db_post_storage_cleanup WHERE created_at < ?1 LIMIT ?2'
                    )
                    .bind(olderThan.toISOString(), Math.max(0, limit))
                    .all<MarkdownCleanup>();
                return results.map(row => ({
                    storage_path: row.storage_path,
                    cleanup_attempts: Number(row.cleanup_attempts)
                }));
            } catch (error) {
                throw new DataError('postCleanup.pendingMarkdown', error);
            }
        },

        async markdownInUse(path: string): Promise<boolean> {
            try {
                return Boolean(
                    await db
                        .prepare('SELECT 1 AS used FROM db_posts WHERE storage_path = ?1')
                        .bind(path)
                        .first()
                );
            } catch (error) {
                throw new DataError('postCleanup.markdownInUse', error);
            }
        },

        async removeMarkdown(paths: string[]) {
            try {
                await bucket.delete(paths.map(contentKey));
            } catch (error) {
                throw new DataError('postCleanup.removeMarkdown', error);
            }
        },

        markdownRemoved: (path: string) =>
            run(
                'postCleanup.markdownRemoved',
                db.prepare('DELETE FROM db_post_storage_cleanup WHERE storage_path = ?1').bind(path)
            ),

        markdownFailed: (item: MarkdownCleanup) =>
            run(
                'postCleanup.markdownFailed',
                db
                    .prepare(
                        `UPDATE db_post_storage_cleanup SET cleanup_attempts = ?2, cleanup_error = 'Markdown cleanup failed; retry required.'
                         WHERE storage_path = ?1`
                    )
                    .bind(item.storage_path, item.cleanup_attempts + 1)
            )
    };
}
