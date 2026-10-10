import { describe, expect, mock, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

mock.module('$app/env/public', () => ({
    PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-key'
}));

const [{ GET: getBlog }, { GET: getBlogPost }, { load: loadBlogPost }] = await Promise.all([
    import('../src/routes/api/v1/blog/+server'),
    import('../src/routes/api/v1/blog/[slug]/+server'),
    import('../src/routes/blog/[slug]/+page.server')
]);
const migration = await readFile(
    new URL('../supabase/migrations/20261008121447_remove_blog_translations.sql', import.meta.url),
    'utf8'
);

describe('removed blog translation query', () => {
    test('rejects lang on the blog list endpoint', async () => {
        const response = await getBlog({
            url: new URL('https://example.test/api/v1/blog?lang=id'),
            request: new Request('https://example.test/api/v1/blog?lang=id')
        } as never);
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ code: 'BLOG_INVALID_LANG' });
    });

    test('rejects lang on the blog detail endpoint', async () => {
        const response = await getBlogPost({
            url: new URL('https://example.test/api/v1/blog/post?lang=id'),
            request: new Request('https://example.test/api/v1/blog/post?lang=id'),
            params: { slug: 'post' },
            fetch
        } as never);
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ code: 'BLOG_INVALID_LANG' });
    });

    test('rejects lang on the article page', async () => {
        await expect(
            loadBlogPost({
                params: { slug: 'post' },
                url: new URL('https://example.test/blog/post?lang=id'),
                fetch
            } as never)
        ).rejects.toMatchObject({ status: 400 });
    });
});

describe('blog translation removal migration', () => {
    test('queues stored translation files before dropping their source table', () => {
        const queueInsert = migration.indexOf('insert into public.db_post_storage_cleanup');
        const translationSelect = migration.indexOf('from public.db_post_translations');
        const tableDrop = migration.indexOf('drop table if exists public.db_post_translations');

        expect(queueInsert).toBeGreaterThanOrEqual(0);
        expect(translationSelect).toBeGreaterThan(queueInsert);
        expect(tableDrop).toBeGreaterThan(translationSelect);
    });

    test('removes translation schema and installs excerpt publication validation', () => {
        expect(migration).toContain(
            'drop function if exists public.db_save_glossary_terms(uuid, text[])'
        );
        expect(migration).toContain('drop table if exists public.db_glossary_terms cascade');
        expect(migration).toContain('create trigger db_posts_require_excerpt_for_publish');
    });
});
