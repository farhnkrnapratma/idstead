import { describe, expect, mock, test } from 'bun:test';

mock.module('$app/env', () => ({ browser: false, dev: false, building: false, version: 'v1' }));

const { pageDataCacheKey } = await import('../packages/lib/src/server/pageDataCache.ts');

const key = (path: string, version = 'v1') =>
    pageDataCacheKey(new URL(`https://fkp.my.id${path}`), version);

describe('pageDataCacheKey', () => {
    test('caches the data of the site section pages only', () => {
        expect(key('/__data.json')).toBe('https://page-data-cache.fkp.my.id/v1/__data.json');
        expect(key('/blog/__data.json')).toContain('/v1/blog/__data.json');
        expect(key('/contact/__data.json')).not.toBeNull();
        expect(key('/blog/some-post/__data.json')).toBeNull();
        expect(key('/privacy/__data.json')).toBeNull();
        expect(key('/blog')).toBeNull();
        expect(key('/api/internal/blog/__data.json')).toBeNull();
    });

    test('drops tracking parameters and keeps the rest in a stable order', () => {
        const tracked = key('/blog/__data.json?_gl=1*abc&x-sveltekit-invalidated=01&utm_source=x');
        const plain = key('/blog/__data.json?x-sveltekit-invalidated=01');
        expect(tracked).toBe(plain);
        expect(key('/blog/__data.json?b=2&a=1')).toBe(key('/blog/__data.json?a=1&b=2'));
    });

    test('changes with the app version so a deploy never serves old data', () => {
        expect(key('/blog/__data.json', 'v1')).not.toBe(key('/blog/__data.json', 'v2'));
    });
});
