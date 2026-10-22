import { describe, expect, mock, test } from 'bun:test';

mock.module('$app/env/public', () => ({}));
mock.module('$app/env/private', () => ({}));

const { DataBackendError, dataStores } = await import('../packages/lib/src/server/data.ts');
const { d1Shim, insertRows, memoryBucket } = await import('./support/d1.ts');

describe('dataStores', () => {
    test('uses the Supabase backend by default and rejects an unknown one', () => {
        expect(() => dataStores({ env: {} })).not.toThrow();
        expect(() => dataStores({ env: { DATA_BACKEND: 'supabase' } })).not.toThrow();
        expect(() => dataStores({ env: { DATA_BACKEND: 'd2' } })).toThrow(DataBackendError);
    });

    test('has public but no service stores without the service role key', () => {
        const stores = dataStores({ env: { SUPABASE_SERVICE_ROLE_KEY: '' } });
        expect(stores.service).toBeNull();
        expect(stores.public.blog).toBeDefined();
    });

    test('has no session stores without a bearer token', () => {
        expect(dataStores({ env: {} }).session).toBeNull();
        expect(
            dataStores({ env: {} }, { request: new Request('https://example.com') }).session
        ).toBeNull();
    });

    test('builds service stores once per call', () => {
        const stores = dataStores({
            env: {
                PUBLIC_SUPABASE_URL: 'https://db.example.com',
                SUPABASE_SERVICE_ROLE_KEY: 'service-role'
            }
        });
        expect(stores.service).not.toBeNull();
        expect(stores.service).toBe(stores.service);
        expect(Object.keys(stores.service!)).toEqual(
            expect.arrayContaining(['blog', 'writers', 'adminPosts', 'activityLog', 'lockout'])
        );
    });

    test('builds every store from the D1 and bucket bindings when DATA_BACKEND is d1', async () => {
        const { db, sqlite } = d1Shim();
        const bucket = memoryBucket({ 'content/posts/p/o.md': '# Hello' });
        insertRows(sqlite, 'db_posts', [
            {
                id: 'p',
                slug: 'hello',
                title: 'Hello',
                excerpt: 'Hi',
                published: true,
                storage_path: 'posts/p/o.md'
            }
        ]);
        const env = { DATA_BACKEND: 'd1', DB: db, ASSET_BUCKET: bucket };
        const stores = dataStores({ env }, { bannerUrls: false });
        const post = (await stores.public.blog.getPublishedBySlug('hello'))!;
        expect(await stores.public.blog.readMarkdown(post.source)).toBe('# Hello');
        expect(await stores.service!.writers.views.record(post, 'visitor')).toEqual({
            counted: true,
            views: 1
        });
        expect(
            (await stores.service!.adminPosts.posts.list()).map(item => item.views_count)
        ).toEqual([1]);
        expect(dataStores({ env }).session).toBeNull();
        const withToken = new Request('https://example.com', {
            headers: { Authorization: 'Bearer token' }
        });
        expect(dataStores({ env }, { request: withToken }).session).toBeNull();
        expect(
            dataStores({ env }, { request: withToken, verifiedAdmin: true }).session
        ).not.toBeNull();
        await expect(
            dataStores({ env: { DATA_BACKEND: 'd1' } }).public.legal.pages()
        ).rejects.toThrow();
    });
});
