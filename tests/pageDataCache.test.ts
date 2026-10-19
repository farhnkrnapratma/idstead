import { describe, expect, mock, test } from 'bun:test';

mock.module('$app/env', () => ({ browser: false, dev: false, building: false, version: 'v1' }));

const { pageDataCache, pageDataCacheKey } =
    await import('../packages/lib/src/server/pageDataCache.ts');

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

describe('pageDataCache handle', () => {
    test('keys on the raw request URL, since SvelteKit strips __data.json from event.url', async () => {
        const store = new Map<string, Response>();
        (globalThis as { caches?: unknown }).caches = {
            default: {
                match: async (key: string) => store.get(key)?.clone(),
                put: async (key: string, response: Response) => void store.set(key, response)
            }
        };
        const event = {
            request: new Request('https://fkp.my.id/blog/__data.json?x-sveltekit-invalidated=001'),
            url: new URL('https://fkp.my.id/blog'),
            isDataRequest: true
        };
        let renders = 0;
        const resolve = async () => {
            renders++;
            return new Response('{"type":"data"}', { status: 200 });
        };
        const handle = pageDataCache as unknown as (input: {
            event: typeof event;
            resolve: typeof resolve;
        }) => Promise<Response>;
        await handle({ event, resolve });
        await new Promise(r => setTimeout(r, 0));
        const second = await handle({ event, resolve });
        expect(renders).toBe(1);
        expect(second.headers.get('X-Page-Data-Cache')).toBe('HIT');
        expect([...store.keys()]).toEqual([
            'https://page-data-cache.fkp.my.id/v1/blog/__data.json?x-sveltekit-invalidated=001'
        ]);
        delete (globalThis as { caches?: unknown }).caches;
    });
});
