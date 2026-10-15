import { describe, expect, test } from 'bun:test';
import { inspectAvif } from '../packages/lib/src/avif.ts';
import {
    parseIdentityMeta,
    validateSiteBanner
} from '../packages/lib/src/server/validateSiteBanner.ts';
import { readFile } from 'node:fs/promises';
import { validateAvatar } from '../packages/lib/src/server/validateAvatar.ts';
import {
    avatarAssetNames,
    bannerAssetNames,
    bannerSizes,
    iconSizes,
    identityAssetNames,
    publicBannerOgUrl,
    siteBannerSources
} from '../packages/lib/src/siteIdentity.ts';

function webp(width: number, height: number) {
    const bytes = new Uint8Array(26);
    const view = new DataView(bytes.buffer);
    bytes.set(new TextEncoder().encode('RIFF'), 0);
    view.setUint32(4, 18, true);
    bytes.set(new TextEncoder().encode('WEBPVP8L'), 8);
    view.setUint32(16, 6, true);
    bytes[20] = 0x2f;
    view.setUint32(21, (width - 1) | ((height - 1) << 14), true);
    return bytes;
}

const bannerAvif = new Uint8Array(
    await readFile(new URL('./fixtures/banner-1280x640.avif', import.meta.url))
);
const avatarAvif = new Uint8Array(
    await readFile(new URL('./fixtures/avatar-512.avif', import.meta.url))
);

function fakeAvif() {
    const bytes = new Uint8Array(64);
    new DataView(bytes.buffer).setUint32(0, 64);
    bytes.set(new TextEncoder().encode('ftypavif'), 4);
    return bytes;
}

function bannerForm(overrides: Record<string, Uint8Array | null> = {}) {
    const form = new FormData();
    const files: Record<string, Uint8Array | null> = {
        'banner.webp': webp(1280, 640),
        'banner.avif': bannerAvif,
        'banner-og.webp': webp(1200, 630),
        ...overrides
    };
    for (const [name, bytes] of Object.entries(files))
        if (bytes) form.set(name, new File([bytes], name));
    return form;
}

describe('validateSiteBanner', () => {
    test('accepts a complete package', async () => {
        const files = await validateSiteBanner(bannerForm());
        expect(Object.keys(files ?? {}).sort()).toEqual([
            'banner-og.webp',
            'banner.avif',
            'banner.webp'
        ]);
    });

    test('returns null when no banner fields are sent', async () => {
        expect(await validateSiteBanner(new FormData())).toBeNull();
    });

    test('rejects an incomplete package', async () => {
        await expect(validateSiteBanner(bannerForm({ 'banner.avif': null }))).rejects.toThrow(
            'complete banner package'
        );
    });

    test('rejects wrong dimensions', async () => {
        await expect(
            validateSiteBanner(bannerForm({ 'banner.webp': webp(1200, 630) }))
        ).rejects.toThrow();
        await expect(
            validateSiteBanner(bannerForm({ 'banner-og.webp': webp(1280, 640) }))
        ).rejects.toThrow();
    });

    test('rejects disguised files', async () => {
        await expect(
            validateSiteBanner(bannerForm({ 'banner.avif': webp(1280, 640) }))
        ).rejects.toThrow('AVIF');
        await expect(
            validateSiteBanner(bannerForm({ 'banner.webp': bannerAvif }))
        ).rejects.toThrow();
        await expect(validateSiteBanner(bannerForm({ 'banner.avif': fakeAvif() }))).rejects.toThrow(
            'AVIF'
        );
        await expect(validateSiteBanner(bannerForm({ 'banner.avif': avatarAvif }))).rejects.toThrow(
            '1280 × 640'
        );
    });

    test('rejects duplicates', async () => {
        const form = bannerForm();
        form.append('banner.webp', new File([webp(1280, 640)], 'banner.webp'));
        await expect(validateSiteBanner(form)).rejects.toThrow();
    });
});

describe('parseIdentityMeta', () => {
    const form = (value: unknown) => {
        const data = new FormData();
        data.set('identity', typeof value === 'string' ? value : JSON.stringify(value));
        return data;
    };
    const fingerprint = 'a'.repeat(64);

    test('defaults to custom when absent', () => {
        expect(parseIdentityMeta(new FormData())).toEqual({
            avatar: { source: 'custom', fingerprint: null },
            banner: { source: 'custom', fingerprint: null }
        });
    });

    test('accepts generated metadata with a fingerprint', () => {
        expect(
            parseIdentityMeta(form({ banner: { source: 'generated', fingerprint } })).banner
        ).toEqual({ source: 'generated', fingerprint });
    });

    test.each([
        [{ avatar: { source: 'generated' } }],
        [{ avatar: { source: 'generated', fingerprint: 'xyz' } }],
        [{ avatar: { source: 'custom', fingerprint } }],
        [{ avatar: { source: 'other', fingerprint: null } }],
        [{ extra: true }],
        [[]],
        ['{not json']
    ])('rejects %j', value => {
        expect(() => parseIdentityMeta(form(value))).toThrow('Invalid image metadata.');
    });
});

describe('banner asset routing', () => {
    test('banner files are served as identity assets', async () => {
        expect(Object.keys(bannerSizes).sort()).toEqual([
            'banner-og.webp',
            'banner.avif',
            'banner.webp'
        ]);
        const source = await readFile(
            new URL('../packages/lib/src/server/profileAssets.ts', import.meta.url),
            'utf8'
        );
        expect(source).toContain('export const assetNames = identityAssetNames;');
        expect(source).toMatch(/name in bannerSizes \? 'banner_version' : 'avatar_version'/);
    });

    test('public banner URLs are versioned and absolute for Open Graph', () => {
        const profile = { bannerVersion: 'v1', siteUrl: 'https://example.com' };
        expect(publicBannerOgUrl(profile)).toBe('https://example.com/banner-og.webp');
        expect(publicBannerOgUrl({ bannerVersion: null, siteUrl: 'https://example.com' })).toBe('');
        expect(siteBannerSources(profile).map(source => source.type)).toEqual([
            'image/avif',
            'image/webp'
        ]);
    });
});

describe('inspectAvif', () => {
    const limits = { maxBytes: 500_000, width: 512, height: 512 };

    test('reads dimensions from a real AVIF', () => {
        expect(inspectAvif(avatarAvif, limits)).toMatchObject({ width: 512, height: 512 });
    });

    test('rejects trailing data and truncation', () => {
        expect(() => inspectAvif(new Uint8Array([...avatarAvif, 1, 2, 3]), limits)).toThrow();
        expect(() => inspectAvif(avatarAvif.slice(0, avatarAvif.length - 10), limits)).toThrow();
    });

    test('rejects a header-only polyglot', () => {
        expect(() => inspectAvif(fakeAvif(), limits)).toThrow();
    });
});

describe('shared identity folder', () => {
    test('avatar and banner assets partition one 13-file package', () => {
        expect(identityAssetNames).toHaveLength(13);
        expect(new Set(identityAssetNames).size).toBe(13);
        expect(avatarAssetNames.filter(name => bannerAssetNames.includes(name))).toEqual([]);
        expect([...avatarAssetNames, ...bannerAssetNames].sort()).toEqual(
            [...identityAssetNames].sort()
        );
        expect(avatarAssetNames).toContain('avatar.avif');
        expect(avatarAssetNames).toContain('avatar.webp');
    });

    test('the database expects the same asset names', async () => {
        const migration = await readFile(
            new URL(
                '../supabase/migrations/20261015120000_shared_identity_versions.sql',
                import.meta.url
            ),
            'utf8'
        );
        const list = migration.match(/unnest\(array\[([\s\S]*?)\]\)/)?.[1] ?? '';
        const names = [...list.matchAll(/'([^']+)'/g)].map(match => match[1]);
        expect(names.sort()).toEqual([...identityAssetNames].sort());
    });

    test('the profile route stages one shared version and copies the unchanged group', async () => {
        const source = await readFile(
            new URL(
                '../apps/admin/src/routes/api/internal/admin/profile/+server.ts',
                import.meta.url
            ),
            'utf8'
        );
        expect(source).toContain("kind: 'identity'");
        expect(source).toContain('copyAssets(platform, version, group.assets)');
        expect(source).toContain('promoteIdentity(platform, version)');
        expect(source).toContain('p_identity: identity');
        expect(source).not.toContain('p_avatar');
        expect(source).not.toContain('p_banner');
    });

    test('the avatar package requires AVIF and WebP', async () => {
        const form = new FormData();
        for (const name of [...Object.keys(iconSizes), 'favicon.ico'])
            form.set(name, new File([new Uint8Array(8)], name));
        form.set('vector', '[]');
        form.set('avatar.webp', new File([webp(512, 512)], 'avatar.webp'));
        await expect(validateAvatar(form)).rejects.toThrow('Upload the complete icon package.');
    });
});

describe('unversioned identity serving', () => {
    test('identity assets are served from canonical keys and reject version queries', async () => {
        const source = await readFile(
            new URL('../packages/lib/src/server/profileAssets.ts', import.meta.url),
            'utf8'
        );
        expect(source).toContain("url.searchParams.has('v')) return missing();");
        expect(source).toContain('Key: `identity/${name}`');
        expect(source).toContain("export const IMAGE_CACHE_CONTROL = 'public, max-age=300';");
        expect(source).not.toContain('immutable');
    });
});
