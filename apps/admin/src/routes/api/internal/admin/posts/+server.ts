import { countReadingMinutes } from '@fkp/domain/readTime.ts';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { apiError } from '#lib/server/apiError.ts';
import { blogAdmin } from '#lib/server/blogPostAuth.ts';
import { parsePostInput } from '#lib/server/blogPostInput.ts';
import {
    savePostOperation,
    BannerRequiredError,
    type PostOperation
} from '#lib/server/blogPostSave.ts';
import { cleanupBlogAssets, putBanner } from '#lib/server/blogBannerStorage.ts';
import { relocateMarkdownAssets, syncPostAssets } from '#lib/server/blogPostAssets.ts';
import { cdnBaseUrl } from '#lib/cdn.ts';
import { UUID_PATTERN } from '#lib/blogBanner.ts';
import { validateDefineForSave } from '@fkp/mdrs';
import { createSupabaseMdrsResolvers } from '#lib/server/mdrsData.ts';
import { buildPostRender } from '#lib/server/postRender.ts';
import { notifyNewPost } from '#lib/server/subscriberBroadcast.ts';
import { logActivity } from '#lib/server/activityLog.ts';
import { runInBackground } from '#lib/server/workerEnv.ts';
import { enqueueNewsletter } from '#lib/server/newsletterQueue.ts';
import { enqueueRenderRefresh } from '#lib/server/renderQueue.ts';
import { ipSalt } from '#lib/server/ipSalt.ts';

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    const db = getSupabaseAdminClient(platform);
    if (!db) return apiError(503, 'BLOG_SAVE_UNAVAILABLE', 'Post storage is not configured.');
    const auth = await blogAdmin(request, url, db);
    if (auth.status)
        return apiError(auth.status, auth.code ?? 'BLOG_SAVE_AUTH_REQUIRED', auth.message);
    let input;
    try {
        const { default: bannerWasm } = await import('virtual:banner-webp-wasm');
        input = await parsePostInput(request, bannerWasm());
    } catch (error) {
        return apiError(
            400,
            'BLOG_SAVE_INVALID_INPUT',
            error instanceof Error ? error.message : 'Invalid post data.'
        );
    }
    try {
        if (input.kind === 'save') {
            const validation = await validateDefineForSave(
                input.markdown,
                createSupabaseMdrsResolvers(db)
            );
            if (!validation.ok)
                return apiError(
                    422,
                    'BLOG_DEFINE_VALIDATION_FAILED',
                    validation.errors.map(error => error.message).join(' | ')
                );
        }
        const { data: previous, error: previousError } = await db
            .from('db_posts')
            .select('id, slug, published, banner_version')
            .eq('id', input.id)
            .maybeSingle();
        if (previousError) throw previousError;
        const cdnBase = cdnBaseUrl();
        if (input.kind === 'save') {
            const { data: owner, error: ownerError } = await db
                .from('db_posts')
                .select('id')
                .eq('slug', input.post.slug as string)
                .neq('id', input.id)
                .limit(1)
                .maybeSingle();
            if (ownerError) throw ownerError;
            if (owner)
                return apiError(
                    422,
                    'BLOG_SAVE_REJECTED',
                    'Post fields could not be committed. Check that the slug is unique.'
                );
            try {
                input.markdown = await relocateMarkdownAssets({
                    platform,
                    cdnBase,
                    markdown: input.markdown,
                    post: {
                        id: input.id,
                        slug: input.post.slug as string,
                        published: input.post.published as boolean
                    },
                    previous
                });
            } catch (error) {
                return apiError(
                    422,
                    'BLOG_SAVE_ASSET_MISSING',
                    error instanceof Error ? error.message : 'A file used in the post is missing.'
                );
            }
        }
        let render: string | null = null;
        if (input.kind === 'save') {
            input.post.read_time = countReadingMinutes(input.markdown);
            try {
                render = JSON.stringify(
                    await buildPostRender(input.markdown, createSupabaseMdrsResolvers(db))
                );
            } catch (error) {
                console.error('Post pre-render failed:', error);
            }
        }
        const operation = await savePostOperation(
            db,
            auth.actor,
            input,
            async () => {
                if (input.image)
                    await putBanner(platform, input.id, input.operationId, input.image, 'webp');
                if (input.avifImage)
                    await putBanner(platform, input.id, input.operationId, input.avifImage, 'avif');
            },
            render
        );
        if (operation.state === 'conflict')
            return apiError(
                409,
                'BLOG_REVISION_CONFLICT',
                'This post changed in another session. Reload before saving.'
            );
        if (operation.state === 'rejected')
            return apiError(
                422,
                'BLOG_SAVE_REJECTED',
                'Post fields could not be committed. Check that the slug is unique.'
            );
        if (operation.result?.published && operation.result.id) {
            const postId = operation.result.id;
            const queued = await enqueueNewsletter({ postId }).catch(error => {
                console.error('Could not queue the subscriber broadcast:', error);
                return false;
            });
            if (!queued)
                await runInBackground(
                    notifyNewPost(db, platform, postId).catch(error => {
                        console.error('Subscriber broadcast failed:', error);
                    })
                );
        }
        if (operation.result?.published || previous?.published)
            await enqueueRenderRefresh().catch(error => {
                console.error('Could not queue the post render refresh:', error);
            });
        let cleanupPending = false;
        try {
            const deleted = input.kind === 'delete' || Boolean(operation.result?.deleted);
            const { data: current, error: readError } = await db
                .from('db_posts')
                .select('id, slug, published, banner_version')
                .eq('id', input.id)
                .maybeSingle();
            if (readError) throw readError;
            await syncPostAssets({
                platform,
                cdnBase,
                markdown: input.kind === 'save' ? input.markdown : null,
                post: current ?? { id: input.id },
                previous,
                deleted: deleted || !current
            });
        } catch (error) {
            console.error('Post asset sync failed:', error);
            cleanupPending = true;
        }
        try {
            const cleanup = await cleanupBlogAssets(db, platform);
            if (cleanup.cleanupPending) cleanupPending = true;
        } catch {
            cleanupPending = true;
        }
        const action =
            input.kind === 'delete' ? 'blog.delete'
            : operation.result?.published ? 'blog.publish'
            : 'blog.update';
        await logActivity(
            {
                actor: auth.actor,
                action,
                category: 'blog',
                entityId: operation.result?.id ?? input.id,
                summary: `${action.replace('blog.', '')} post${operation.result?.slug ? ` "${operation.result.slug}"` : ''}.`,
                ip: (() => {
                    try {
                        return getClientAddress();
                    } catch {
                        return null;
                    }
                })(),
                ipSalt: ipSalt(platform),
                userAgent: request.headers.get('user-agent') ?? undefined
            },
            db
        );
        return json(
            {
                success: true,
                operationId: operation.id,
                post: operation.result,
                markdown: input.kind === 'save' ? input.markdown : null,
                cleanupPending
            },
            { headers: { 'Cache-Control': 'no-store' } }
        );
    } catch (error) {
        if (error instanceof BannerRequiredError)
            return apiError(400, 'BLOG_SAVE_INVALID_INPUT', error.message);
        if ((error as { code?: string })?.code === '22023')
            return apiError(
                409,
                'BLOG_OPERATION_REUSED',
                'This operation ID was used for different post data.'
            );
        return apiError(
            503,
            'BLOG_SAVE_UNCONFIRMED',
            'Save is not confirmed. Check its status or retry the same operation.',
            input.operationId
        );
    }
};

export const GET: RequestHandler = async ({ request, url, platform }) => {
    const db = getSupabaseAdminClient(platform);
    if (!db) return apiError(503, 'BLOG_SAVE_UNAVAILABLE', 'Post storage is not configured.');
    const auth = await blogAdmin(request, url, db);
    if (auth.status)
        return apiError(auth.status, auth.code ?? 'BLOG_SAVE_AUTH_REQUIRED', auth.message);
    const id = url.searchParams.get('operationId') || '';
    if (!UUID_PATTERN.test(id))
        return apiError(400, 'BLOG_OPERATION_INVALID', 'A valid operation ID is required.');
    const { data, error } = await db
        .from('db_post_operations')
        .select('id, state, result')
        .eq('id', id)
        .eq('actor_id', auth.actor)
        .maybeSingle();
    if (error)
        return apiError(
            503,
            'BLOG_RECONCILIATION_UNAVAILABLE',
            'Save status could not be checked. Retry shortly.'
        );
    if (!data) return json({ state: 'unknown' }, { headers: { 'Cache-Control': 'no-store' } });
    const operation = data as PostOperation;
    return json(
        { operationId: operation.id, state: operation.state, post: operation.result },
        { headers: { 'Cache-Control': 'no-store' } }
    );
};
