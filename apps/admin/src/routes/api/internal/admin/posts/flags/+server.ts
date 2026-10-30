import type { RequestHandler } from './$types';
import { dataStores } from '#lib/server/data.ts';
import { apiError } from '#lib/server/apiError.ts';
import { blogAdmin } from '#lib/server/blogPostAuth.ts';
import { UUID_PATTERN } from '#lib/blogBanner.ts';
import { logActivity } from '#lib/server/activityLog.ts';
import { queuePostEffects } from '#lib/server/postEffects.ts';
import { ipSalt } from '#lib/server/ipSalt.ts';
import { movePostBanner } from '#lib/server/blogPostAssets.ts';

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    const service = dataStores(platform).service;
    if (!service) return apiError(503, 'BLOG_POSTS_UNAVAILABLE', 'Post storage is not configured.');
    const auth = await blogAdmin(request, url, platform);
    if (auth.status)
        return apiError(auth.status, auth.code ?? 'BLOG_POSTS_AUTH_REQUIRED', auth.message);
    let body: { id?: unknown; published?: unknown; pinned?: unknown };
    try {
        body = await request.json();
    } catch {
        return apiError(400, 'INVALID_JSON_BODY', 'Invalid JSON body.');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body))
        return apiError(400, 'INVALID_JSON_BODY', 'Invalid JSON body.');
    const id = typeof body.id === 'string' ? body.id.toLowerCase() : '';
    if (!UUID_PATTERN.test(id)) return apiError(400, 'BLOG_POST_INVALID', 'Invalid post id.');
    const flags = Object.keys(body).filter(key => key !== 'id');
    if (
        flags.length !== 1
        || !['published', 'pinned'].includes(flags[0])
        || typeof body[flags[0] as 'published' | 'pinned'] !== 'boolean'
    )
        return apiError(
            400,
            'BLOG_POST_FLAGS_INVALID',
            'Send exactly one of published or pinned as a boolean.'
        );
    const flag = flags[0] as 'published' | 'pinned';
    const value = body[flag] as boolean;
    const posts = service.adminPosts.posts;
    let previous;
    let update;
    try {
        previous = await posts.assetState(id);
        if (!previous) return apiError(404, 'BLOG_POST_NOT_FOUND', 'Post not found.');
        update = await posts.setFlags(id, { [flag]: value });
    } catch (error) {
        console.error('Admin post flag update failed:', error);
        return apiError(503, 'BLOG_POSTS_UNAVAILABLE', 'The post could not be updated.');
    }
    if (update.status === 'not-found')
        return apiError(404, 'BLOG_POST_NOT_FOUND', 'Post not found.');
    if (update.status === 'excerpt-required')
        return apiError(
            422,
            'BLOG_POST_EXCERPT_REQUIRED',
            'Add a manual excerpt before publishing this post.'
        );
    if (update.status === 'pin-limit')
        return apiError(422, 'BLOG_POST_PIN_LIMIT', 'Maximum of 3 pinned posts allowed.');
    const { post } = update;
    if (flag === 'published' && post.published !== previous.published)
        await movePostBanner({ platform, post, previous }).catch(error =>
            console.error('Post banner move failed:', error)
        );
    if (flag === 'published')
        await queuePostEffects(service.writers.newsletter, platform, {
            postId: post.id,
            published: post.published,
            wasPublished: previous.published
        });
    const action =
        flag === 'published' ?
            value ? 'blog.publish'
            :   'blog.unpublish'
        : value ? 'blog.pin'
        : 'blog.unpin';
    await logActivity(
        {
            actor: auth.actor,
            action,
            category: 'blog',
            entityId: post.id,
            summary: `${action.replace('blog.', '')} post "${post.slug}".`,
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
        { post_revision: post.post_revision, published: post.published, pinned: post.pinned },
        { headers: { 'Cache-Control': 'no-store' } }
    );
};
