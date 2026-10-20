import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { createSupabaseAdminPostStore } from '@idstead/data';
import { apiError } from '#lib/server/apiError.ts';
import { blogAdmin } from '#lib/server/blogPostAuth.ts';
import { boundedBody } from '#lib/server/blogPostInput.ts';
import { UUID_PATTERN, stagingAssetHome } from '#lib/blogBanner.ts';
import { CONTENT_VIDEO_LIMIT, isWebm } from '#app/blogContentVideo.ts';
import { assetFileName } from '@idstead/domain/assetNaming.ts';
import { cdnBaseUrl } from '#lib/cdn.ts';
import { uniqueAssetName } from '#lib/server/blogPostAssets.ts';
import { putContentAsset } from '#lib/server/blogContentStorage.ts';

export const POST: RequestHandler = async ({ request, url, platform }) => {
    const db = getSupabaseAdminClient(platform);
    if (!db)
        return apiError(
            503,
            'BLOG_CONTENT_VIDEO_UNAVAILABLE',
            'Content video storage is not configured.'
        );
    const auth = await blogAdmin(request, url, db);
    if (auth.status)
        return apiError(auth.status, auth.code ?? 'BLOG_CONTENT_VIDEO_AUTH_REQUIRED', auth.message);

    let bytes: Uint8Array<ArrayBuffer>;
    let postId: string;
    let base: string;
    try {
        const form = await (await boundedBody(request, CONTENT_VIDEO_LIMIT + 8192)).formData();
        const file = form.get('file');
        const postValue = form.get('postId');
        const nameValue = form.get('name');
        if (typeof postValue !== 'string' || !UUID_PATTERN.test(postValue))
            throw new Error('A valid post ID is required.');
        if (typeof nameValue !== 'string' || nameValue.length > 255)
            throw new Error('A file name is required.');
        if (!(file instanceof Blob) || !file.size) throw new Error('A video file is required.');
        if (file.size > CONTENT_VIDEO_LIMIT) throw new Error('Video must be 50 MB or less.');
        postId = postValue.toLowerCase();
        base = assetFileName(nameValue, 'video');
        bytes = new Uint8Array(await file.arrayBuffer());
    } catch (error) {
        return apiError(
            400,
            'BLOG_CONTENT_VIDEO_INVALID_INPUT',
            error instanceof Error ? error.message : 'Invalid video upload.'
        );
    }

    if (!isWebm(bytes))
        return apiError(400, 'BLOG_CONTENT_VIDEO_INVALID_FORMAT', 'Choose a WebM video file.');

    const home = stagingAssetHome(postId);
    let name: string;
    try {
        const post = await createSupabaseAdminPostStore(db).assetState(postId);
        name = await uniqueAssetName({
            platform,
            post: { id: postId, slug: post?.slug, published: post?.published },
            kind: 'videos',
            base,
            ext: 'webm'
        });
        await putContentAsset(platform, `${home}/videos/${name}.webm`, bytes, 'video/webm');
    } catch {
        return apiError(
            502,
            'BLOG_CONTENT_VIDEO_STORAGE_FAILED',
            'Could not store the uploaded video. Try again.'
        );
    }

    return json(
        { url: `${cdnBaseUrl()}/${home}/videos/${name}.webm`, bytes: bytes.length },
        { status: 201 }
    );
};
