import type { RequestHandler } from './$types';
import { adminServices } from '#lib/server/adminRequest.ts';
import { apiError } from '#lib/server/apiError.ts';
import { boundedBody } from '#lib/server/blogPostInput.ts';
import { UUID_PATTERN, stagingAssetHome } from '#lib/blogBanner.ts';
import { CONTENT_IMAGE_LIMIT } from '#lib/blogContentImage.ts';
import { assetFileName } from '@idstead/domain/assetNaming.ts';
import { cdnBaseUrl } from '#lib/cdn.ts';
import { uniqueAssetName } from '#lib/server/blogPostAssets.ts';
import {
    validateContentImage,
    validateContentImageAvif
} from '#lib/server/validateContentImage.ts';
import { putContentAsset } from '#lib/server/blogContentStorage.ts';

export const POST: RequestHandler = async ({ request, url, platform }) => {
    const admin = await adminServices(request, url, platform, {
        code: 'BLOG_CONTENT_IMAGE_UNAVAILABLE',
        message: 'Content image storage is not configured.'
    });
    if (admin.response) return admin.response;
    const { service } = admin;

    let bytes: Uint8Array<ArrayBuffer>;
    let avifBytes: Uint8Array<ArrayBuffer>;
    let postId: string;
    let base: string;
    try {
        const form = await (await boundedBody(request, CONTENT_IMAGE_LIMIT * 2 + 8192)).formData();
        const file = form.get('file');
        const avifFile = form.get('fileAvif');
        const postValue = form.get('postId');
        const nameValue = form.get('name');
        if (typeof postValue !== 'string' || !UUID_PATTERN.test(postValue))
            throw new Error('A valid post ID is required.');
        if (typeof nameValue !== 'string' || nameValue.length > 255)
            throw new Error('A file name is required.');
        if (!(file instanceof Blob) || !file.size) throw new Error('An image file is required.');
        if (file.size > CONTENT_IMAGE_LIMIT)
            throw new Error('Image must be no larger than 500 KiB after compression.');
        if (!(avifFile instanceof Blob) || !avifFile.size)
            throw new Error('An AVIF image is required.');
        if (avifFile.size > CONTENT_IMAGE_LIMIT)
            throw new Error('AVIF image must be no larger than 500 KiB.');
        postId = postValue.toLowerCase();
        base = assetFileName(nameValue, 'image');
        bytes = new Uint8Array(await file.arrayBuffer());
        avifBytes = new Uint8Array(await avifFile.arrayBuffer());
    } catch (error) {
        return apiError(
            400,
            'BLOG_CONTENT_IMAGE_INVALID_INPUT',
            error instanceof Error ? error.message : 'Invalid image upload.'
        );
    }

    let metadata;
    try {
        const { default: contentWasm } = await import('virtual:banner-webp-wasm');
        metadata = await validateContentImage(bytes, contentWasm());
        validateContentImageAvif(avifBytes, metadata);
    } catch (error) {
        return apiError(
            400,
            'BLOG_CONTENT_IMAGE_INVALID',
            error instanceof Error ? error.message : 'Invalid image data.'
        );
    }

    const home = stagingAssetHome(postId);
    let name: string;
    try {
        const post = await service.adminPosts.posts.assetState(postId);
        name = await uniqueAssetName({
            platform,
            post: { id: postId, slug: post?.slug, published: post?.published },
            kind: 'images',
            base,
            ext: 'avif'
        });
        await putContentAsset(platform, `${home}/images/${name}.webp`, bytes, 'image/webp');
        await putContentAsset(platform, `${home}/images/${name}.avif`, avifBytes, 'image/avif');
    } catch {
        return apiError(
            502,
            'BLOG_CONTENT_IMAGE_STORAGE_FAILED',
            'Could not store the uploaded image. Try again.'
        );
    }

    return Response.json(
        {
            url: `${cdnBaseUrl()}/${home}/images/${name}.avif`,
            width: metadata.width,
            height: metadata.height,
            bytes: metadata.bytes
        },
        { status: 201 }
    );
};
