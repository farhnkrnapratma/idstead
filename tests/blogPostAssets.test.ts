// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, mock, test } from 'bun:test';
import { bannerKey } from '../packages/lib/src/blogBanner.ts';
import { memoryPlatform } from './support/assets.ts';

mock.module('$app/env/private', () => ({}));
mock.module('$app/env/public', () => ({}));

const assets = await import('../packages/lib/src/server/blogPostAssets.ts');

const ID = '11111111-1111-4111-8111-111111111111';
const VERSION = '22222222-2222-4222-8222-222222222222';
const STAGING = `staging/blog/${ID}`;
const HOME = 'blog/my-post';
const CDN = 'https://cdn.test';

const draft = { id: ID, slug: 'my-post', published: false, banner_version: VERSION };
const published = { ...draft, published: true };

describe('object helpers', () => {
    test('check, list, copy and delete stored objects', async () => {
        const { platform, store } = memoryPlatform([`${HOME}/a.avif`, `${HOME}/b.bin`]);
        expect(await assets.objectExists(platform, `${HOME}/a.avif`)).toBe(true);
        expect(await assets.objectExists(platform, 'missing')).toBe(false);
        expect((await assets.listKeys(platform, `${HOME}/`)).map(item => item.key)).toEqual([
            `${HOME}/a.avif`,
            `${HOME}/b.bin`
        ]);
        await assets.copyObject(platform, `${HOME}/a.avif`, `${HOME}/c.webp`);
        await assets.copyObject(platform, `${HOME}/a.avif`, `${HOME}/c.webm`);
        await assets.copyObject(platform, `${HOME}/a.avif`, `${HOME}/c.xyz`);
        expect(store.size).toBe(5);
        await assets.deleteKeys(platform, [`${HOME}/c.webp`]);
        expect(store.has(`${HOME}/c.webp`)).toBe(false);
    });

    test('deletes only well-formed post folders', async () => {
        const { platform, store } = memoryPlatform([`${HOME}/images/a.webp`, 'blog/banners/x']);
        await expect(assets.deletePrefix(platform, 'blog/banners/')).rejects.toThrow(
            'Invalid asset folder.'
        );
        await expect(assets.deletePrefix(platform, 'blog/my-post')).rejects.toThrow(
            'Invalid asset folder.'
        );
        await assets.deletePrefix(platform, 'blog/empty/');
        await assets.deletePrefix(platform, `${HOME}/`);
        expect([...store.keys()]).toEqual(['blog/banners/x']);
    });

    test('finds referenced assets with their sibling formats', () => {
        const markdown = [
            `![a](${CDN}/${HOME}/images/photo.avif)`,
            `![b](${CDN}/${HOME}/images/other.webp)`,
            `<video src="${CDN}/${HOME}/videos/clip.webm"></video>`,
            `![c](${CDN}/blog/other-post/images/skip.avif)`
        ].join('\n');
        expect([...assets.referencedAssets(markdown, CDN, HOME)].sort()).toEqual([
            `${HOME}/images/other.webp`,
            `${HOME}/images/photo.avif`,
            `${HOME}/images/photo.webp`,
            `${HOME}/videos/clip.webm`
        ]);
    });
});

describe('relocateMarkdownAssets', () => {
    const relocate = (
        keys: string[],
        markdown: string,
        extra: Partial<Parameters<typeof assets.relocateMarkdownAssets>[0]> = {}
    ) => {
        const memory = memoryPlatform(keys);
        return {
            ...memory,
            run: () =>
                assets.relocateMarkdownAssets({
                    platform: memory.platform,
                    cdnBase: CDN,
                    markdown,
                    post: published,
                    previous: null,
                    ...extra
                })
        };
    };
    const staged = `![a](${CDN}/${STAGING}/images/photo.avif)`;

    test('returns the Markdown untouched without a CDN or foreign folders', async () => {
        expect(await relocate([], staged, { cdnBase: '' }).run()).toBe(staged);
        expect(await relocate([], staged, { post: draft }).run()).toBe(staged);
    });

    test('moves staged files into the published folder', async () => {
        const { run, store } = relocate(
            [`${STAGING}/images/photo.avif`, `${STAGING}/images/photo.webp`],
            staged
        );
        expect(await run()).toBe(`![a](${CDN}/${HOME}/images/photo.avif)`);
        expect(store.has(`${HOME}/images/photo.avif`)).toBe(true);
        expect(store.has(`${HOME}/images/photo.webp`)).toBe(true);
    });

    test('moves files from the previous folder', async () => {
        const previous = { ...published, slug: 'old-post' };
        const markdown = `![a](${CDN}/blog/old-post/videos/clip.webm)`;
        const { run, store } = relocate(['blog/old-post/videos/clip.webm'], markdown, { previous });
        expect(await run()).toBe(`![a](${CDN}/${HOME}/videos/clip.webm)`);
        expect(store.has(`${HOME}/videos/clip.webm`)).toBe(true);
    });

    test('keeps files that already sit in the target folder', async () => {
        const { run, store } = relocate(
            [
                `${STAGING}/images/photo.avif`,
                `${STAGING}/images/photo.webp`,
                `${HOME}/images/photo.avif`,
                `${HOME}/images/photo.webp`
            ],
            `![a](${CDN}/${STAGING}/images/photo.avif)`
        );
        for (const ext of ['avif', 'webp'])
            store.set(`${HOME}/images/photo.${ext}`, store.get(`${STAGING}/images/photo.${ext}`)!);
        await run();
        expect(store.get(`${HOME}/images/photo.avif`)).toBe(
            store.get(`${STAGING}/images/photo.avif`)
        );
    });

    test('reports missing and conflicting files', async () => {
        const missing = relocate([], staged);
        await expect(missing.run()).rejects.toThrow('A file used in the post is missing');
        const conflict = relocate(
            [`${STAGING}/images/photo.avif`, `${HOME}/images/photo.avif`],
            `![a](${CDN}/${STAGING}/images/photo.avif)`
        );
        await expect(conflict.run()).rejects.toThrow('already exists in the post folder');
    });
});

describe('syncPostAssets', () => {
    const sync = (
        keys: string[],
        extra: Partial<Parameters<typeof assets.syncPostAssets>[0]> = {}
    ) => {
        const memory = memoryPlatform(keys);
        return {
            ...memory,
            run: () =>
                assets.syncPostAssets({
                    platform: memory.platform,
                    cdnBase: CDN,
                    markdown: null,
                    post: published,
                    previous: null,
                    ...extra
                })
        };
    };

    test('rejects invalid posts', async () => {
        await expect(sync([], { post: { ...published, id: 'nope' } }).run()).rejects.toThrow(
            'Invalid post.'
        );
    });

    test('removes every folder of a deleted post', async () => {
        const { run, store } = sync(
            [`${HOME}/images/a.webp`, `${STAGING}/images/b.webp`, 'blog/keep/x'],
            { deleted: true, previous: published }
        );
        await run();
        expect([...store.keys()]).toEqual(['blog/keep/x']);
        const bare = sync([`${STAGING}/images/b.webp`], { deleted: true });
        await bare.run();
        expect(bare.store.size).toBe(0);
    });

    test('publishes a staged banner', async () => {
        const { run, store } = sync([bannerKey(ID, VERSION, 'webp')]);
        await run();
        expect(store.has(`${HOME}/banner.webp`)).toBe(true);
        expect(store.has(bannerKey(ID, VERSION, 'webp'))).toBe(false);
    });

    test('copies the banner from the previous or staging folder', async () => {
        const fromStaging = sync([`${STAGING}/banner.webp`]);
        await fromStaging.run();
        expect(fromStaging.store.has(`${HOME}/banner.webp`)).toBe(true);
        const fromPrevious = sync([`blog/old/banner.webp`], {
            previous: { ...published, slug: 'old' }
        });
        await fromPrevious.run();
        expect(fromPrevious.store.has(`${HOME}/banner.webp`)).toBe(true);
        expect(fromPrevious.store.has('blog/old/banner.webp')).toBe(false);
        const keepsTarget = sync([`${HOME}/banner.avif`, `${STAGING}/banner.avif`]);
        await keepsTarget.run();
        expect(keepsTarget.store.size).toBe(1);
    });

    test('drops assets the Markdown no longer uses', async () => {
        const { run, store } = sync(
            [`${HOME}/images/used.webp`, `${HOME}/images/unused.webp`, `${HOME}/videos/old.webm`],
            {
                markdown: `![a](${CDN}/${HOME}/images/used.webp)`,
                post: { ...published, banner_version: null }
            }
        );
        await run();
        expect([...store.keys()]).toEqual([`${HOME}/images/used.webp`]);
    });

    test('removes banners when the post has none', async () => {
        const { run, store } = sync([`${HOME}/banner.webp`, `${HOME}/banner.avif`], {
            post: { ...published, banner_version: null }
        });
        await run();
        expect(store.size).toBe(0);
    });

    test('keeps staging for drafts and prunes the previous folder', async () => {
        const { run, store } = sync([`${STAGING}/images/a.webp`, 'blog/old/images/b.webp'], {
            post: draft,
            previous: { ...published, slug: 'old' },
            markdown: null
        });
        await run();
        expect([...store.keys()]).toEqual([`${STAGING}/images/a.webp`]);
    });
});

describe('cleanupOrphanedStaging', () => {
    const OLD = new Date(Date.now() - 30 * 86_400_000);
    const OTHER = '33333333-3333-4333-8333-333333333333';
    const LIVE = '44444444-4444-4444-8444-444444444444';

    test('does nothing without a bucket', async () => {
        expect(await assets.cleanupOrphanedStaging({} as App.Platform, async () => false)).toBe(0);
    });

    test('removes old folders of posts that no longer exist', async () => {
        const keys = [
            `staging/blog/${ID}/images/a.webp`,
            `staging/blog/${OTHER}/images/a.webp`,
            `staging/blog/${LIVE}/images/a.webp`,
            'staging/blog/not-a-uuid/x',
            'staging/blog'
        ];
        const uploaded = { [keys[0]]: OLD, [keys[2]]: OLD, [keys[3]]: OLD };
        const { platform, store } = memoryPlatform(keys, uploaded);
        const removed = await assets.cleanupOrphanedStaging(platform, async id => id === LIVE);
        expect(removed).toBe(1);
        expect(store.has(keys[0])).toBe(false);
        expect(store.has(keys[1])).toBe(true);
        expect(store.has(keys[2])).toBe(true);
    });
});

describe('uniqueAssetName', () => {
    const pick = (keys: string[]) =>
        assets.uniqueAssetName({
            platform: memoryPlatform(keys).platform,
            post: published,
            kind: 'images',
            base: 'photo',
            ext: 'avif'
        });

    test('uses the base name when free and numbers collisions', async () => {
        expect(await pick([])).toBe('photo');
        expect(await pick([`${HOME}/images/photo.avif`])).toBe('photo-2');
        expect(await pick([`${STAGING}/images/photo.avif`, `${HOME}/images/photo-2.avif`])).toBe(
            'photo-3'
        );
    });

    test('gives up after fifty attempts', async () => {
        const keys = [`${HOME}/images/photo.avif`];
        for (let attempt = 2; attempt <= 50; attempt++)
            keys.push(`${HOME}/images/photo-${attempt}.avif`);
        await expect(pick(keys)).rejects.toThrow('Too many files share this name');
    });
});
