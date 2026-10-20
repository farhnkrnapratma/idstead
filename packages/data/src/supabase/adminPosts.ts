import type { SupabaseClient } from '@supabase/supabase-js';
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
import { DataError } from '../errors';
import { postMarkdownPath, postRenderPath } from './paths';

const BUCKET = 'blog-posts';
const POSTS = 'db_posts';
const OPERATIONS = 'db_post_operations';
const BANNER_VERSIONS = 'db_blog_banner_versions';
const MARKDOWN_CLEANUP = 'db_post_storage_cleanup';
const ASSET_STATE_FIELDS = 'id, slug, published, banner_version';

type PostRow = Omit<AdminPost, 'read_minutes' | 'views_count' | 'comment_count' | 'tags'> & {
    tags: string[] | null;
    helpful_yes: number | null;
    helpful_no: number | null;
    read_time: number | null;
    view_count: number | null;
    db_comments: { count: number }[] | null;
};

type DbError = { code?: string; message?: string } | null;

type DraftRow = Omit<AdminPostDraft, 'markdown' | 'tags' | 'collaborators'> & {
    storage_path: string | null;
    tags: string[] | null;
    collaborators: string[] | null;
};

type FlagsRow = PostAssetState & { pinned: boolean; post_revision: number };

function assetState(row: PostAssetState): PostAssetState {
    return {
        id: row.id,
        slug: row.slug,
        published: Boolean(row.published),
        banner_version: row.banner_version ?? null
    };
}

function adminPost(row: PostRow): AdminPost {
    return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        published: Boolean(row.published),
        pinned: Boolean(row.pinned),
        storage_path: row.storage_path ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at ?? null,
        banner_version: row.banner_version ?? null,
        post_revision: row.post_revision,
        excerpt: row.excerpt ?? null,
        tags: row.tags ?? [],
        helpful_yes: row.helpful_yes ?? 0,
        helpful_no: row.helpful_no ?? 0,
        read_minutes: typeof row.read_time === 'number' && row.read_time > 0 ? row.read_time : null,
        views_count: row.view_count ?? 0,
        comment_count: row.db_comments?.[0]?.count ?? 0
    };
}

export function createSupabaseAdminPostStore(db: SupabaseClient): AdminPostStore {
    async function count(column: string, value: string, operation: string) {
        const { count, error } = await db
            .from(POSTS)
            .select('id', { count: 'exact', head: true })
            .eq(column, value);
        if (error) throw new DataError(operation, error);
        return count ?? 0;
    }

    return {
        async list(): Promise<AdminPost[]> {
            const { data, error } = await db
                .from(POSTS)
                .select(
                    'id, title, slug, published, pinned, storage_path, created_at, updated_at, banner_version, post_revision, excerpt, tags, helpful_yes, helpful_no, read_time, view_count, db_comments(count)'
                )
                .order('created_at', { ascending: false });
            if (error) throw new DataError('adminPosts.list', error);
            return ((data ?? []) as unknown as PostRow[]).map(adminPost);
        },

        async get(id: string): Promise<AdminPostDraft | null> {
            const { data, error } = await db
                .from(POSTS)
                .select(
                    'id, title, slug, published, banner_version, post_revision, excerpt, tags, collaborators, storage_path'
                )
                .eq('id', id)
                .maybeSingle();
            if (error) throw new DataError('adminPosts.get', error);
            if (!data) return null;
            const post = data as DraftRow;
            let markdown: string | null = null;
            if (post.storage_path) {
                const { data: file, error: fileError } = await db.storage
                    .from(BUCKET)
                    .download(post.storage_path);
                if (fileError || !file) throw new DataError('adminPosts.get.markdown', fileError);
                markdown = await file.text();
            }
            return {
                id: post.id,
                title: post.title,
                slug: post.slug,
                published: Boolean(post.published),
                banner_version: post.banner_version ?? null,
                post_revision: post.post_revision,
                excerpt: post.excerpt ?? null,
                tags: post.tags ?? [],
                collaborators: post.collaborators ?? [],
                markdown
            };
        },

        async assetState(id: string): Promise<PostAssetState | null> {
            const { data, error } = await db
                .from(POSTS)
                .select(ASSET_STATE_FIELDS)
                .eq('id', id)
                .maybeSingle();
            if (error) throw new DataError('adminPosts.assetState', error);
            return data ? assetState(data as PostAssetState) : null;
        },

        async slugTaken(slug: string, exceptId: string): Promise<boolean> {
            const { data, error } = await db
                .from(POSTS)
                .select('id')
                .eq('slug', slug)
                .neq('id', exceptId)
                .limit(1)
                .maybeSingle();
            if (error) throw new DataError('adminPosts.slugTaken', error);
            return Boolean(data);
        },

        async exists(id: string): Promise<boolean> {
            return (await count('id', id, 'adminPosts.exists')) > 0;
        },

        async setFlags(id: string, flags: PostFlags): Promise<PostFlagsUpdate> {
            const patch: PostFlags = {};
            if (typeof flags.published === 'boolean') patch.published = flags.published;
            if (typeof flags.pinned === 'boolean') patch.pinned = flags.pinned;
            if (!Object.keys(patch).length)
                throw new DataError('adminPosts.setFlags', 'No flags to update.');
            const { data, error } = (await db
                .from(POSTS)
                .update(patch)
                .eq('id', id)
                .select(`${ASSET_STATE_FIELDS}, pinned, post_revision`)
                .maybeSingle()) as { data: FlagsRow | null; error: DbError };
            if (error?.code === '23514') return { status: 'excerpt-required' };
            if (error?.message?.includes('Maximum of 3 pinned posts'))
                return { status: 'pin-limit' };
            if (error) throw new DataError('adminPosts.setFlags', error);
            if (!data) return { status: 'not-found' };
            return {
                status: 'updated',
                post: {
                    ...assetState(data),
                    pinned: Boolean(data.pinned),
                    post_revision: data.post_revision
                }
            };
        }
    };
}

export function createSupabasePostOperationStore(db: SupabaseClient): PostOperationStore {
    const bucket = () => db.storage.from(BUCKET);

    return {
        async prepare(request: PostOperationRequest): Promise<PostOperationPreparation> {
            const { data, error } = (await db.rpc('db_prepare_post_operation', {
                p_id: request.operationId,
                p_actor: request.actor,
                p_post_id: request.postId,
                p_hash: request.hash,
                p_revision: request.revision,
                p_kind: request.kind,
                p_post: request.post,
                p_banner: request.banner
            })) as { data: PostOperation | null; error: DbError };
            if (error?.code === '22023') return { status: 'reused' };
            if (error || !data) throw new DataError('postOperations.prepare', error);
            return { status: 'prepared', operation: data };
        },

        async revision(postId: string) {
            const { data, error } = await db
                .from(POSTS)
                .select('banner_version, post_revision')
                .eq('id', postId)
                .maybeSingle();
            if (error) throw new DataError('postOperations.revision', error);
            return (
                (data as { post_revision: number; banner_version: string | null } | null) ?? null
            );
        },

        async writeMarkdown(postId: string, operationId: string, markdown: string) {
            const path = postMarkdownPath(postId, operationId);
            const { error } = await bucket().upload(
                path,
                new Blob([markdown], { type: 'text/markdown' }),
                { contentType: 'text/markdown', upsert: false }
            );
            if (!error) return;
            const { data: existing, error: readError } = await bucket().download(path);
            if (readError || !existing || (await existing.text()) !== markdown)
                throw new DataError('postOperations.writeMarkdown', error);
        },

        async writeRender(postId: string, operationId: string, render: string) {
            const path = postRenderPath(postMarkdownPath(postId, operationId));
            if (!path) throw new DataError('postOperations.writeRender', 'Invalid render path.');
            const { error } = await bucket().upload(
                path,
                new Blob([render], { type: 'application/json' }),
                { contentType: 'application/json', upsert: true }
            );
            if (error) throw new DataError('postOperations.writeRender', error);
        },

        async ready(operationId: string, actor: string) {
            const { error } = await db.rpc('db_ready_post_operation', {
                p_id: operationId,
                p_actor: actor
            });
            if (error) throw new DataError('postOperations.ready', error);
        },

        async commit(operationId: string, actor: string): Promise<PostOperation> {
            const { data, error } = (await db.rpc('db_commit_post_operation', {
                p_id: operationId,
                p_actor: actor
            })) as { data: PostOperation | null; error: DbError };
            if (error || !data) throw new DataError('postOperations.commit', error);
            return data;
        },

        async find(operationId: string, actor: string): Promise<PostOperation | null> {
            const { data, error } = await db
                .from(OPERATIONS)
                .select('id, state, result')
                .eq('id', operationId)
                .eq('actor_id', actor)
                .maybeSingle();
            if (error) throw new DataError('postOperations.find', error);
            return (data as PostOperation | null) ?? null;
        }
    };
}

export function createSupabasePostCleanupStore(db: SupabaseClient): PostCleanupStore {
    return {
        async claimBanners(): Promise<BannerCleanup[]> {
            const { data, error } = await db.rpc('db_claim_blog_banner_cleanup');
            if (error) throw new DataError('postCleanup.claimBanners', error);
            return (data ?? []) as BannerCleanup[];
        },

        async bannerRemoved(id: string) {
            const { error } = await db
                .from(BANNER_VERSIONS)
                .update({ state: 'deleted', cleanup_error: null })
                .eq('id', id)
                .eq('state', 'cleaning');
            if (error) throw new DataError('postCleanup.bannerRemoved', error);
        },

        async bannerFailed(id: string) {
            const { error } = await db
                .from(BANNER_VERSIONS)
                .update({ cleanup_error: 'R2 cleanup failed; retry required.' })
                .eq('id', id);
            if (error) throw new DataError('postCleanup.bannerFailed', error);
        },

        async pendingMarkdown(olderThan: Date, limit: number): Promise<MarkdownCleanup[]> {
            const { data, error } = await db
                .from(MARKDOWN_CLEANUP)
                .select('storage_path, cleanup_attempts')
                .lt('created_at', olderThan.toISOString())
                .limit(limit);
            if (error) throw new DataError('postCleanup.pendingMarkdown', error);
            return ((data ?? []) as MarkdownCleanup[]).map(row => ({
                storage_path: row.storage_path,
                cleanup_attempts: row.cleanup_attempts
            }));
        },

        async markdownInUse(path: string): Promise<boolean> {
            const { count, error } = await db
                .from(POSTS)
                .select('id', { count: 'exact', head: true })
                .eq('storage_path', path);
            if (error) throw new DataError('postCleanup.markdownInUse', error);
            return Boolean(count);
        },

        async removeMarkdown(paths: string[]) {
            const { error } = await db.storage.from(BUCKET).remove(paths);
            if (error) throw new DataError('postCleanup.removeMarkdown', error);
        },

        async markdownRemoved(path: string) {
            const { error } = await db.from(MARKDOWN_CLEANUP).delete().eq('storage_path', path);
            if (error) throw new DataError('postCleanup.markdownRemoved', error);
        },

        async markdownFailed(item: MarkdownCleanup) {
            const { error } = await db
                .from(MARKDOWN_CLEANUP)
                .update({
                    cleanup_attempts: item.cleanup_attempts + 1,
                    cleanup_error: 'Markdown cleanup failed; retry required.'
                })
                .eq('storage_path', item.storage_path);
            if (error) throw new DataError('postCleanup.markdownFailed', error);
        }
    };
}
