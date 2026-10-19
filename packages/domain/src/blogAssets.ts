export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function bannerKey(postId: string, version: string, ext: 'webp' | 'avif' = 'webp') {
    if (!UUID_PATTERN.test(postId) || !UUID_PATTERN.test(version))
        throw new Error('Invalid banner identity.');
    return `blog/banners/${postId}/${version}.${ext}`;
}

export interface PostAssetOwner {
    id: string;
    slug?: string | null;
    published?: boolean | null;
}

const SLUG_PATTERN = /^(?!(?:banners|content)$)[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function stagingAssetHome(postId: string) {
    if (!UUID_PATTERN.test(postId)) throw new Error('Invalid banner identity.');
    return `staging/blog/${postId}`;
}

export function postAssetHome(post: PostAssetOwner) {
    if (post.published && post.slug && SLUG_PATTERN.test(post.slug)) return `blog/${post.slug}`;
    return stagingAssetHome(post.id);
}

export function bannerObjectKey(post: PostAssetOwner, ext: 'webp' | 'avif' = 'webp') {
    return `${postAssetHome(post)}/banner.${ext}`;
}

export function bannerUrl(
    post: PostAssetOwner & { banner_version?: string | null },
    cdnBase: string
) {
    return post.banner_version ? `${cdnBase}/${bannerObjectKey(post)}` : null;
}
