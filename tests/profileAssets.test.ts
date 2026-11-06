// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { identityVersionToken } from '../packages/domain/src/hash.ts';

const state = {
    adminAuthor: undefined as unknown,
    current: async () => ({ avatar: null, banner: null }) as unknown
};

mock.module('../packages/lib/src/server/data.ts', () => ({
    dataStores: () => ({
        service: state.adminAuthor ? { adminAuthor: state.adminAuthor } : undefined,
        public: { identity: { current: () => state.current() } }
    })
}));

const assets = await import('../packages/lib/src/server/profileAssets.ts');

const VERSION = '0f8fad5b-d9cb-469f-a165-70867728950e';
const OTHER = '1f8fad5b-d9cb-469f-a165-70867728950e';

function memoryBucket() {
    const store = new Map<string, { bytes: Uint8Array; httpMetadata?: Record<string, string> }>();
    const bucket = {
        store,
        deleted: [] as string[][],
        async get(key: string) {
            const entry = store.get(key);
            if (!entry) return null;
            return {
                key,
                etag: 'e',
                httpEtag: `"${key}"`,
                uploaded: new Date(0),
                httpMetadata: entry.httpMetadata,
                body: new Response(entry.bytes as BodyInit).body!,
                arrayBuffer: async () => entry.bytes.slice().buffer
            };
        },
        async put(key: string, value: ArrayBuffer, options?: { httpMetadata?: object }) {
            store.set(key, {
                bytes: new Uint8Array(value),
                httpMetadata: options?.httpMetadata as Record<string, string>
            });
            return null;
        },
        async delete(keys: string | string[]) {
            const list = Array.isArray(keys) ? keys : [keys];
            bucket.deleted.push(list);
            for (const key of list) store.delete(key);
        }
    };
    return bucket;
}

let bucket = memoryBucket();
const platform = () => ({ env: { ASSET_BUCKET: bucket, PUBLIC_CDN_BASE_URL: '' } }) as never;
const seed = (key: string, text = 'bytes', contentType?: string) =>
    bucket.store.set(key, {
        bytes: new TextEncoder().encode(text),
        httpMetadata: contentType ? { contentType } : undefined
    });

beforeEach(() => {
    bucket = memoryBucket();
    state.adminAuthor = undefined;
    state.current = async () => ({ avatar: null, banner: null });
});

describe('writeAssets', () => {
    test('stores files and describes them', async () => {
        const files = {
            'avatar.png': new Uint8Array([1, 2, 3]).buffer,
            'banner.webp': new Uint8Array([4]).buffer,
            'favicon.svg': new Uint8Array([5]).buffer,
            'favicon.ico': new Uint8Array([6]).buffer,
            'avatar.avif': new Uint8Array([7]).buffer,
            'avatar.webp': new Uint8Array([8]).buffer,
            'favicon-16x16.png': new Uint8Array([9]).buffer,
            'unknown.bin': new Uint8Array([10]).buffer
        };
        const written = await assets.writeAssets(platform(), VERSION, files);
        const byName = Object.fromEntries(written.map(asset => [asset.name, asset]));
        expect(byName['avatar.png']).toMatchObject({
            key: `identity/${VERSION}/avatar.png`,
            type: 'image/png',
            width: 512,
            height: 512,
            bytes: 3
        });
        expect(byName['avatar.png'].sha256).toHaveLength(64);
        expect(byName['banner.webp']).toMatchObject({ width: 1280, height: 640 });
        expect(byName['favicon.svg']).toMatchObject({ type: 'image/svg+xml', width: 128 });
        expect(byName['favicon.ico']).toMatchObject({ type: 'image/x-icon', width: 48 });
        expect(byName['avatar.avif']).toMatchObject({ type: 'image/avif', width: 512 });
        expect(byName['avatar.webp']).toMatchObject({ type: 'image/webp', width: 512 });
        expect(byName['favicon-16x16.png'].width).toBe(16);
        expect(byName['unknown.bin'].type).toBe('application/octet-stream');
        expect(bucket.store.get(`identity/${VERSION}/avatar.png`)?.httpMetadata).toEqual({
            contentType: 'image/png',
            cacheControl: assets.IMAGE_CACHE_CONTROL
        });
    });

    test('fails without storage', async () => {
        await expect(assets.writeAssets({ env: {} } as never, VERSION, {})).rejects.toThrow(
            'Image storage is not configured.'
        );
    });
});

describe('copy, promote and remove', () => {
    test('copies listed assets to a new version', async () => {
        seed('identity/avatar.png', 'a');
        const copied = await assets.copyAssets(platform(), VERSION, [
            { name: 'avatar.png', key: 'old', type: 'image/png' } as never
        ]);
        expect(copied[0].key).toBe(`identity/${VERSION}/avatar.png`);
        expect(bucket.store.has(`identity/${VERSION}/avatar.png`)).toBe(true);
    });

    test('rejects invalid versions and names', async () => {
        await expect(assets.copyAssets(platform(), 'bad', [])).rejects.toThrow(
            'Invalid identity version.'
        );
        await expect(
            assets.copyAssets(platform(), VERSION, [{ name: 'evil.png' } as never])
        ).rejects.toThrow('Invalid identity asset.');
        await expect(assets.promoteIdentity(platform(), 'bad')).rejects.toThrow(
            'Invalid identity version.'
        );
    });

    test('promotes a version to canonical and removes the staged copy', async () => {
        for (const name of assets.assetNames) seed(`identity/${VERSION}/${name}`, name);
        await assets.promoteIdentity(platform(), VERSION);
        for (const name of assets.assetNames) {
            expect(bucket.store.has(`identity/${name}`)).toBe(true);
            expect(bucket.store.has(`identity/${VERSION}/${name}`)).toBe(false);
        }
        expect(bucket.store.get('identity/avatar.png')?.httpMetadata?.contentType).toBe(
            'image/png'
        );
    });

    test('removes canonical identity assets', async () => {
        seed('identity/avatar.png');
        await assets.removeCanonicalIdentity(platform());
        expect(bucket.store.size).toBe(0);
    });
});

describe('cleanupAssets', () => {
    test('requires a database', async () => {
        await expect(assets.cleanupAssets(platform())).rejects.toThrow(
            'Database is not configured.'
        );
    });

    test('removes claimed versions', async () => {
        const deleted: string[] = [];
        state.adminAuthor = {
            claimIdentityCleanup: async () => [VERSION, OTHER],
            deleteIdentityVersion: async (version: string) => void deleted.push(version)
        };
        seed(`identity/${VERSION}/avatar.png`);
        expect(await assets.cleanupAssets(platform())).toBe(2);
        expect(deleted).toEqual([VERSION, OTHER]);
        expect(bucket.store.size).toBe(0);
    });
});

describe('reading identity objects', () => {
    test('reads avatar bytes', async () => {
        seed(`identity/${VERSION}/avatar.png`, 'png');
        const bytes = await assets.readAvatarBytes(platform(), VERSION);
        expect(new TextDecoder().decode(bytes!)).toBe('png');
    });

    test('returns null for missing, invalid or unreadable avatars', async () => {
        expect(await assets.readAvatarBytes(platform())).toBeNull();
        expect(await assets.readAvatarBytes(platform(), 'bad')).toBeNull();
        expect(await assets.readAvatarBytes(platform(), VERSION)).toBeNull();
        const warn = console.warn;
        console.warn = () => {};
        try {
            expect(await assets.readAvatarBytes({ env: {} } as never, VERSION)).toBeNull();
        } finally {
            console.warn = warn;
        }
    });

    test('falls back to the canonical object and validates input', async () => {
        seed('identity/avatar.png', 'canonical');
        const object = await assets.readIdentityObject(platform(), VERSION, 'avatar.png');
        expect(object?.key).toBe('identity/avatar.png');
        await expect(assets.readIdentityObject(platform(), 'bad', 'avatar.png')).rejects.toThrow(
            'Invalid identity asset.'
        );
        await expect(assets.readIdentityObject(platform(), VERSION, 'nope.png')).rejects.toThrow(
            'Invalid identity asset.'
        );
    });
});

describe('serveIdentityAsset', () => {
    const serve = (path: string, init: RequestInit = {}, pf: unknown = platform()) => {
        const url = new URL('https://site.test' + path);
        return assets.serveIdentityAsset(new Request(url, init), url, pf as never);
    };
    const realFetch = globalThis.fetch;
    afterEach(() => {
        globalThis.fetch = realFetch;
    });

    test('404s unknown names', async () => {
        const response = await serve('/nope.png');
        expect(response.status).toBe(404);
        expect(response.headers.get('cache-control')).toBe('no-store');
    });

    test('503s when metadata is unavailable', async () => {
        state.current = async () => {
            throw new Error('down');
        };
        expect((await serve('/avatar.png')).status).toBe(503);
    });

    test('404s when no version exists and there is no CDN', async () => {
        expect((await serve('/hero.png')).status).toBe(404);
    });

    test('404s fallbacks that must not be proxied', async () => {
        const pf = { env: { PUBLIC_CDN_BASE_URL: 'https://cdn.test/' } };
        expect((await serve('/banner.webp', {}, pf)).status).toBe(404);
        expect((await serve('/favicon.svg', {}, pf)).status).toBe(404);
        expect((await serve('/avatar.png', {}, pf)).status).toBe(404);
    });

    test('proxies the hero image from the CDN', async () => {
        const seen: string[] = [];
        globalThis.fetch = (async (url: string) => {
            seen.push(url);
            return new Response('hero', { status: 200, headers: { 'content-type': 'image/png' } });
        }) as never;
        const pf = { env: { PUBLIC_CDN_BASE_URL: 'https://cdn.test//' } };
        const response = await serve('/hero.png', {}, pf);
        expect(seen).toEqual(['https://cdn.test/hero.png']);
        expect(await response.text()).toBe('hero');
        expect(response.headers.get('content-type')).toBe('image/png');
        const head = await serve('/hero.png', { method: 'HEAD' }, pf);
        expect(await head.text()).toBe('');
    });

    test('proxies other icons and defaults the content type', async () => {
        const seen: string[] = [];
        globalThis.fetch = (async (url: string) => {
            seen.push(url);
            return new Response(null, { status: 502 });
        }) as never;
        const pf = { env: { PUBLIC_CDN_BASE_URL: 'https://cdn.test' } };
        const response = await serve('/favicon.ico', {}, pf);
        expect(seen).toEqual(['https://cdn.test/favicon.ico']);
        expect(response.status).toBe(502);
        expect(response.headers.get('content-type')).toBe('application/octet-stream');
    });

    test('serves stored objects with caching headers', async () => {
        state.current = async () => ({ avatar: VERSION, banner: OTHER });
        seed(`identity/${VERSION}/avatar.png`, 'png', 'image/png');
        const plain = await serve('/avatar.png');
        expect(plain.headers.get('cache-control')).toBe(assets.IMAGE_CACHE_CONTROL);
        expect(plain.headers.get('x-content-type-options')).toBe('nosniff');
        expect(await plain.text()).toBe('png');
        const token = await identityVersionToken(VERSION);
        const immutable = await serve(`/avatar.png?v=${token}`);
        expect(immutable.headers.get('cache-control')).toBe(assets.IMMUTABLE_CACHE_CONTROL);
        const head = await serve('/hero.png', { method: 'HEAD' });
        expect(head.status).toBe(200);
        expect(await head.text()).toBe('');
    });

    test('answers conditional requests', async () => {
        state.current = async () => ({ avatar: VERSION, banner: null });
        seed(`identity/${VERSION}/avatar.png`);
        const etag = `"identity/${VERSION}/avatar.png"`;
        expect((await serve('/avatar.png', { headers: { 'if-none-match': etag } })).status).toBe(
            304
        );
        expect(
            (await serve('/avatar.png', { headers: { 'if-none-match': `W/${etag}` } })).status
        ).toBe(304);
        expect((await serve('/avatar.png', { headers: { 'if-none-match': '*' } })).status).toBe(
            304
        );
        expect((await serve('/avatar.png', { headers: { 'if-none-match': '"x"' } })).status).toBe(
            200
        );
    });

    test('sandboxes svg and misses absent objects', async () => {
        state.current = async () => ({ avatar: VERSION, banner: null });
        seed(`identity/${VERSION}/favicon.svg`, '<svg/>', 'image/svg+xml');
        const svg = await serve('/favicon.svg');
        expect(svg.headers.get('content-security-policy')).toContain('sandbox');
        expect((await serve('/avatar.webp')).status).toBe(404);
    });

    test('falls back to the default content type', async () => {
        state.current = async () => ({ avatar: VERSION, banner: null });
        seed(`identity/${VERSION}/avatar.png`);
        expect((await serve('/avatar.png')).headers.get('content-type')).toBe(
            'application/octet-stream'
        );
    });
});
