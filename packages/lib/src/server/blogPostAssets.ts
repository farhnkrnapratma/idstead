// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { IMMUTABLE_CACHE_CONTROL } from './profileAssets';
import {
    assetBucket,
    findAssetBucket,
    copyObject as copyStoredObject,
    deleteObjects,
    listObjects
} from './r2';
import {
    bannerKey,
    postAssetHome,
    stagingAssetHome,
    UUID_PATTERN,
    type PostAssetOwner
} from '#lib/blogBanner.ts';

const STAGING_GRACE_MS = 7 * 86_400_000;

const contentTypes: Record<string, string> = {
    avif: 'image/avif',
    webp: 'image/webp',
    webm: 'video/webm'
};

export type AssetKind = 'images' | 'videos';

export async function objectExists(platform: App.Platform | undefined, key: string) {
    return (await objectTag(platform, key)) !== null;
}

async function objectTag(platform: App.Platform | undefined, key: string) {
    const object = await (await assetBucket(platform)).head(key);
    return object ? object.etag : null;
}

export async function listKeys(platform: App.Platform | undefined, prefix: string) {
    const objects = await listObjects(await assetBucket(platform), prefix);
    return objects.map(item => ({ key: item.key, modified: item.uploaded.getTime() }));
}

export async function copyObject(platform: App.Platform | undefined, from: string, to: string) {
    const ext = to.split('.').pop() ?? '';
    await copyStoredObject(await assetBucket(platform), from, to, {
        contentType: contentTypes[ext] ?? 'application/octet-stream',
        cacheControl: IMMUTABLE_CACHE_CONTROL
    });
}

export async function deleteKeys(platform: App.Platform | undefined, keys: string[]) {
    await deleteObjects(await assetBucket(platform), keys);
}

export async function deletePrefix(platform: App.Platform | undefined, prefix: string) {
    if (
        !/^(?:blog\/(?!(?:banners|content)\/)[a-z0-9-]+|staging\/blog\/[0-9a-f-]{36})\/$/.test(
            prefix
        )
    )
        throw new Error('Invalid asset folder.');
    const keys = (await listKeys(platform, prefix)).map(item => item.key);
    if (keys.length) await deleteKeys(platform, keys);
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assetPattern(cdnBase: string, homes: string[]) {
    return new RegExp(
        `${escapeRegExp(cdnBase)}/(${homes.map(escapeRegExp).join('|')})/(images|videos)/([a-z0-9-]+\\.(?:avif|webp|webm))`,
        'g'
    );
}

function siblings(kind: string, file: string) {
    return kind === 'images' && file.endsWith('.avif') ?
            [file, file.replace(/\.avif$/, '.webp')]
        :   [file];
}

export function referencedAssets(markdown: string, cdnBase: string, home: string) {
    const keys = new Set<string>();
    for (const [, , kind, file] of markdown.matchAll(assetPattern(cdnBase, [home])))
        for (const name of siblings(kind, file)) keys.add(`${home}/${kind}/${name}`);
    return keys;
}

export async function relocateMarkdownAssets(options: {
    platform: App.Platform | undefined;
    cdnBase: string;
    markdown: string;
    post: PostAssetOwner;
    previous: PostAssetOwner | null;
}) {
    const { platform, cdnBase, post, previous } = options;
    if (!cdnBase) return options.markdown;
    const home = postAssetHome(post);
    const sources = [stagingAssetHome(post.id)];
    if (previous) sources.push(postAssetHome(previous));
    const homes = [...new Set(sources)].filter(source => source !== home);
    if (!homes.length) return options.markdown;
    const moves = new Map<string, string>();
    const markdown = options.markdown.replace(
        assetPattern(cdnBase, homes),
        (_match, source: string, kind: string, file: string) => {
            for (const name of siblings(kind, file))
                moves.set(`${source}/${kind}/${name}`, `${home}/${kind}/${name}`);
            return `${cdnBase}/${home}/${kind}/${file}`;
        }
    );
    for (const [from, to] of moves) {
        const [source, target] = await Promise.all([
            objectTag(platform, from),
            objectTag(platform, to)
        ]);
        if (source === null && target === null)
            throw new Error(`A file used in the post is missing: ${from.split('/').pop()}`);
        if (source !== null && target !== null && source !== target)
            throw new Error(
                `Another file named ${to.split('/').pop()} already exists in the post folder. Rename the upload and try again.`
            );
        if (source !== null && target === null) await copyObject(platform, from, to);
    }
    return markdown;
}

export async function movePostBanner(options: {
    platform: App.Platform | undefined;
    post: PostAssetOwner & { banner_version?: string | null };
    previous: PostAssetOwner;
}) {
    const { platform, post, previous } = options;
    const from = postAssetHome(previous);
    const to = postAssetHome(post);
    if (!post.banner_version || from === to) return;
    for (const ext of ['webp', 'avif'] as const) {
        const source = `${from}/banner.${ext}`;
        if (!(await objectExists(platform, source))) continue;
        await copyObject(platform, source, `${to}/banner.${ext}`);
        await deleteKeys(platform, [source]);
    }
}

export async function syncPostAssets(options: {
    platform: App.Platform | undefined;
    cdnBase: string;
    markdown: string | null;
    post: PostAssetOwner & { banner_version?: string | null };
    previous: (PostAssetOwner & { banner_version?: string | null }) | null;
    deleted?: boolean;
}) {
    const { platform, cdnBase, post, previous } = options;
    if (!UUID_PATTERN.test(post.id)) throw new Error('Invalid post.');
    const staging = `${stagingAssetHome(post.id)}/`;
    const previousHome = previous ? `${postAssetHome(previous)}/` : null;
    if (options.deleted) {
        if (previousHome) await deletePrefix(platform, previousHome);
        await deletePrefix(platform, staging);
        return;
    }
    const home = `${postAssetHome(post)}/`;
    if (post.banner_version) {
        for (const ext of ['webp', 'avif'] as const) {
            const target = `${home}banner.${ext}`;
            const staged = bannerKey(post.id, post.banner_version, ext);
            if (await objectExists(platform, staged)) {
                await copyObject(platform, staged, target);
                await deleteKeys(platform, [staged]);
                continue;
            }
            for (const folder of new Set([previousHome, staging])) {
                if (!folder || folder === home) continue;
                const old = `${folder}banner.${ext}`;
                if (!(await objectExists(platform, old))) continue;
                if (folder === previousHome || !(await objectExists(platform, target)))
                    await copyObject(platform, old, target);
                break;
            }
        }
    }
    if (options.markdown !== null && cdnBase) {
        const used = referencedAssets(options.markdown, cdnBase, home.slice(0, -1));
        const unused = [
            ...(await listKeys(platform, `${home}images/`)),
            ...(await listKeys(platform, `${home}videos/`))
        ]
            .map(item => item.key)
            .filter(key => !used.has(key));
        if (unused.length) await deleteKeys(platform, unused);
    }
    if (!post.banner_version) {
        const banners = (await listKeys(platform, `${home}banner.`)).map(item => item.key);
        if (banners.length) await deleteKeys(platform, banners);
    }
    if (previousHome && previousHome !== home) await deletePrefix(platform, previousHome);
    if (home !== staging) await deletePrefix(platform, staging);
}

export async function cleanupOrphanedStaging(
    platform: App.Platform | undefined,
    postExists: (postId: string) => Promise<boolean>
) {
    if (!(await findAssetBucket(platform))) return 0;
    const objects = await listKeys(platform, 'staging/blog/');
    const folders = new Map<string, number>();
    for (const item of objects) {
        const id = item.key.split('/')[2];
        if (!id || !UUID_PATTERN.test(id)) continue;
        folders.set(id, Math.max(folders.get(id) ?? 0, item.modified));
    }
    let removed = 0;
    for (const [id, modified] of folders) {
        if (Date.now() - modified < STAGING_GRACE_MS || (await postExists(id))) continue;
        await deletePrefix(platform, `staging/blog/${id}/`);
        removed++;
    }
    return removed;
}

export async function uniqueAssetName(options: {
    platform: App.Platform | undefined;
    post: PostAssetOwner;
    kind: AssetKind;
    base: string;
    ext: 'avif' | 'webm';
}) {
    const { platform, post, kind, base, ext } = options;
    const homes = [...new Set([stagingAssetHome(post.id), postAssetHome(post)])];
    for (let attempt = 1; attempt <= 50; attempt++) {
        const name = attempt === 1 ? base : `${base}-${attempt}`;
        const taken = await Promise.all(
            homes.map(home => objectExists(platform, `${home}/${kind}/${name}.${ext}`))
        );
        if (!taken.some(Boolean)) return name;
    }
    throw new Error('Too many files share this name. Rename the file and try again.');
}
