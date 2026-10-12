import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { apiError } from '#lib/server/apiError.ts';
import { blogAdmin } from '#lib/server/blogPostAuth.ts';
import { boundedBody } from '#lib/server/blogPostInput.ts';
import { sha256 } from '#lib/blogBanner.ts';
import { CONTENT_VIDEO_LIMIT, sniffVideoFormat, contentVideoKey } from '#lib/blogContentVideo.ts';
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
    if (auth.status) return apiError(auth.status, 'BLOG_CONTENT_VIDEO_AUTH_REQUIRED', auth.message);

    let bytes: Uint8Array<ArrayBuffer>;
    try {
        const form = await (await boundedBody(request, CONTENT_VIDEO_LIMIT + 8192)).formData();
        const file = form.get('file');
        if (!(file instanceof Blob) || !file.size) throw new Error('A video file is required.');
        if (file.size > CONTENT_VIDEO_LIMIT) throw new Error('Video must be 50 MB or less.');
        bytes = new Uint8Array(await file.arrayBuffer());
    } catch (error) {
        return apiError(
            400,
            'BLOG_CONTENT_VIDEO_INVALID_INPUT',
            error instanceof Error ? error.message : 'Invalid video upload.'
        );
    }

    const sniff = sniffVideoFormat(bytes.subarray(0, 12));
    if (!sniff)
        return apiError(
            400,
            'BLOG_CONTENT_VIDEO_INVALID_FORMAT',
            'Choose an MP4 or WebM video file.'
        );

    const hash = await sha256(bytes);
    const key = contentVideoKey(hash, sniff.ext);
    try {
        await putContentAsset(platform, key, bytes, sniff.contentType);
    } catch {
        return apiError(
            502,
            'BLOG_CONTENT_VIDEO_STORAGE_FAILED',
            'Could not store the uploaded video. Try again.'
        );
    }

    return json({ url: `/${key}`, bytes: bytes.length }, { status: 201 });
};
