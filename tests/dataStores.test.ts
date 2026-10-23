import { describe, expect, mock, test } from 'bun:test';

mock.module('$app/env/public', () => ({}));
mock.module('$app/env/private', () => ({}));

const { dataStores } = await import('../packages/lib/src/server/data.ts');
const { d1Shim, insertRows, memoryBucket } = await import('./support/d1.ts');

describe('dataStores', () => {
    test('builds service stores once per call', () => {
        const stores = dataStores({ env: {} });
        expect(stores.service).toBe(stores.service);
        expect(Object.keys(stores.service)).toEqual(
            expect.arrayContaining([
                'blog',
                'writers',
                'adminPosts',
                'activityLog',
                'lockout',
                'authorWriter',
                'legalWriter'
            ])
        );
    });

    test('builds every store from the D1 and bucket bindings', async () => {
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
        const env = { DB: db, ASSET_BUCKET: bucket };
        const stores = dataStores({ env }, { bannerUrls: false });
        const post = (await stores.public.blog.getPublishedBySlug('hello'))!;
        expect(await stores.public.blog.readMarkdown(post.source)).toBe('# Hello');
        expect(await stores.service.writers.views.record(post, 'visitor')).toEqual({
            counted: true,
            views: 1
        });
        expect(
            (await stores.service.adminPosts.posts.list()).map(item => item.views_count)
        ).toEqual([1]);
        await expect(dataStores({ env: {} }).public.legal.pages()).rejects.toThrow();
    });

    test('caches public reads through the Cache API when DATA_CACHE is on', async () => {
        const stored = new Map<string, string>();
        const keys: string[] = [];
        const previous = (globalThis as { caches?: unknown }).caches;
        (globalThis as { caches?: unknown }).caches = {
            open: async () => ({
                match: async (key: string) =>
                    stored.has(key) ? new Response(stored.get(key)) : undefined,
                put: async (key: string, response: Response) => {
                    keys.push(key);
                    stored.set(key, await response.text());
                }
            })
        };
        try {
            const { db, sqlite } = d1Shim();
            insertRows(sqlite, 'db_legals', [{ slug: 'terms', title: 'Terms', content: '# T' }]);
            const env = {
                DATA_CACHE: '1',
                DB: db,
                ASSET_BUCKET: memoryBucket(),
                CF_VERSION_METADATA: { id: 'version-7' }
            };
            expect((await dataStores({ env }).public.legal.pages())[0].title).toBe('Terms');
            expect((await dataStores({ env }).public.legal.pages())[0].title).toBe('Terms');
            expect(keys).toHaveLength(1);
            expect(keys[0]).toContain('/version-7/legal%401/legal.pages');
            sqlite.run("UPDATE db_legals SET title = 'Changed'");
            expect((await dataStores({ env }).public.legal.pages())[0].title).toBe('Changed');
            expect(keys).toHaveLength(2);
        } finally {
            (globalThis as { caches?: unknown }).caches = previous;
        }
    });
});
