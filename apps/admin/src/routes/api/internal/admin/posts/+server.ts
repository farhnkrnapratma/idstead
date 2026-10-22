import { countReadingMinutes } from '@idstead/domain/readTime.ts';
import type { RequestHandler } from './$types';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { dataStores } from '#lib/server/data.ts';
import { apiError } from '#lib/server/apiError.ts';
import { blogAdmin } from '#lib/server/blogPostAuth.ts';
import { parsePostInput } from '#lib/server/blogPostInput.ts';
import {
    savePostOperation,
    BannerRequiredError,
    OperationReusedError
} from '#lib/server/blogPostSave.ts';
import { cleanupBlogAssets, putBanner } from '#lib/server/blogBannerStorage.ts';
import { relocateMarkdownAssets, syncPostAssets } from '#lib/server/blogPostAssets.ts';
import { cdnBaseUrl } from '#lib/cdn.ts';
import { UUID_PATTERN } from '#lib/blogBanner.ts';
import { validateDefineForSave } from '@mdrs/core';
import { mdrsResolvers } from '#lib/server/mdrsData.ts';
import { buildPostRender } from '#lib/server/postRender.ts';
import { siteRenderOptions } from '#lib/mdrsOptions.ts';
import { configuredSiteUrl } from '#lib/server/siteUrl.ts';
import { logActivity } from '#lib/server/activityLog.ts';
import { queuePostEffects } from '#lib/server/postEffects.ts';
import { ipSalt } from '#lib/server/ipSalt.ts';

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    const db = getSupabaseAdminClient(platform);
    const service = dataStores(platform).service;
    if (!db || !service)
        return apiError(503, 'BLOG_SAVE_UNAVAILABLE', 'Post storage is not configured.');
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
    const stores = service.adminPosts;
    try {
        if (input.kind === 'save') {
            const validation = await validateDefineForSave(input.markdown, mdrsResolvers(service));
            if (!validation.ok)
                return apiError(
                    422,
                    'BLOG_DEFINE_VALIDATION_FAILED',
                    validation.errors.map(error => error.message).join(' | ')
                );
        }
        const previous = await stores.posts.assetState(input.id);
        const cdnBase = cdnBaseUrl();
        if (input.kind === 'save') {
            if (await stores.posts.slugTaken(input.post.slug as string, input.id))
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
                    await buildPostRender(
                        input.markdown,
                        mdrsResolvers(service),
                        siteRenderOptions(configuredSiteUrl(platform))
                    )
                );
            } catch (error) {
                console.error('Post pre-render failed:', error);
            }
        }
        const operation = await savePostOperation(
            stores.operations,
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
        await queuePostEffects(service.writers.newsletter, platform, {
            postId: operation.result?.id ?? input.id,
            published: Boolean(operation.result?.published && operation.result.id),
            wasPublished: Boolean(previous?.published)
        });
        let cleanupPending = false;
        try {
            const deleted = input.kind === 'delete' || Boolean(operation.result?.deleted);
            const current = await stores.posts.assetState(input.id);
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
            const cleanup = await cleanupBlogAssets(stores, platform);
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
            service.activityLog
        );
        return Response.json(
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
        if (error instanceof OperationReusedError)
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
    const service = dataStores(platform).service;
    if (!db || !service)
        return apiError(503, 'BLOG_SAVE_UNAVAILABLE', 'Post storage is not configured.');
    const auth = await blogAdmin(request, url, db);
    if (auth.status)
        return apiError(auth.status, auth.code ?? 'BLOG_SAVE_AUTH_REQUIRED', auth.message);
    const id = url.searchParams.get('operationId') || '';
    if (!UUID_PATTERN.test(id))
        return apiError(400, 'BLOG_OPERATION_INVALID', 'A valid operation ID is required.');
    let operation;
    try {
        operation = await service.adminPosts.operations.find(id, auth.actor);
    } catch {
        return apiError(
            503,
            'BLOG_RECONCILIATION_UNAVAILABLE',
            'Save status could not be checked. Retry shortly.'
        );
    }
    if (!operation)
        return Response.json({ state: 'unknown' }, { headers: { 'Cache-Control': 'no-store' } });
    return Response.json(
        { operationId: operation.id, state: operation.state, post: operation.result },
        { headers: { 'Cache-Control': 'no-store' } }
    );
};
