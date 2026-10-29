import { describe, expect, test } from 'bun:test';
import { DataError } from '../packages/data/src/errors.ts';
import { createD1SiteDataStore } from '../packages/data/src/d1/siteData.ts';
import { d1Shim, insertRows, memoryBucket } from './support/d1.ts';

const PROFILE = '00000000-0000-4000-8000-000000000001';
const POST = '00000000-0000-4000-8000-000000000002';

describe('D1 site data adapter', () => {
    const V1 = '00000000-0000-4000-8000-000000000011';
    const V2 = '00000000-0000-4000-8000-000000000012';

    function seeded() {
        const { db, sqlite } = d1Shim();
        const bucket = memoryBucket({ 'content/posts/p/o.md': '# Hello' });
        insertRows(sqlite, 'db_identity_versions', [
            { id: V1, source: 'custom', avatar_source: 'custom', banner_source: 'custom' },
            { id: V2, source: 'custom', avatar_source: 'custom', banner_source: 'custom' }
        ]);
        insertRows(sqlite, 'db_profiles', [
            {
                id: PROFILE,
                name: 'Ada',
                username: 'ada',
                headline: 'h',
                job_title: 'j',
                bio: 'b',
                avatar: '',
                email: 'ada@example.com',
                city: 'c',
                postal_code: '1',
                country: 'ID',
                site_url: 'https://example.com',
                avatar_version: V1,
                banner_version: V1
            }
        ]);
        sqlite
            .query('update db_identity_versions set profile_id = ? where id = ?')
            .run(PROFILE, V1);
        insertRows(sqlite, 'db_posts', [
            {
                id: POST,
                slug: 'hello',
                title: 'Hello',
                excerpt: 'Hi',
                published: true,
                storage_path: 'posts/p/o.md',
                tags: '["svelte"]',
                created_at: '2026-10-01T00:00:00.000Z'
            }
        ]);
        insertRows(
            sqlite,
            'db_views',
            Array.from({ length: 4 }, (_, n) => ({ post_id: POST, ip_hash: `v${n}` }))
        );
        insertRows(sqlite, 'db_comments', [
            { id: 'c1', post_id: POST, author_name: 'Ann', content: 'hi' }
        ]);
        insertRows(sqlite, 'db_comment_reports', [{ comment_id: 'c1', reason: 'spam' }]);
        insertRows(sqlite, 'db_legals', [{ slug: 'terms', title: 'Terms', content: '# Terms' }]);
        insertRows(sqlite, 'db_project_repo_rules', [
            { author_id: PROFILE, rule_type: 'pin', repo_name: 'repo', sort_order: 1 }
        ]);
        insertRows(sqlite, 'db_documents', [
            {
                filename: 'resume.pdf',
                file_url: 'u',
                hash: 'h',
                is_active: true,
                author_id: PROFILE
            },
            { filename: 'old.pdf', file_url: 'u', hash: 'o', is_active: false, author_id: PROFILE }
        ]);
        insertRows(sqlite, 'db_admin_settings', [{ user_id: 'u', settings: '{"theme":"dark"}' }]);
        insertRows(sqlite, 'db_subscribers', [{ email: 'a@example.com', unsubscribe_token: 't' }]);
        return { sqlite, store: createD1SiteDataStore(db, bucket) };
    }

    test('collects every export table, plans the delete and reads post markdown', async () => {
        const { store } = seeded();
        const { tables: data, failures } = await store.exportTables();
        expect(failures).toEqual([]);
        expect(
            data.posts.map(post => [post.slug, post.view_count, post.published, post.tags])
        ).toEqual([['hello', 4, true, ['svelte']]]);
        expect(data.comments[0]).toMatchObject({ is_admin: false, is_approved: false });
        expect(data.activeDocuments.map(doc => doc.filename)).toEqual(['resume.pdf']);
        expect(data.settings).toEqual([{ settings: { theme: 'dark' } }]);
        expect(data.subscribers).toEqual([
            {
                email: 'a@example.com',
                status: 'pending',
                confirmed_at: null,
                unsubscribed_at: null,
                created_at: expect.any(String)
            }
        ]);
        expect(data.avatarVersion).toBe(V1);
        expect(await store.deletionPlan()).toEqual({
            documents: ['resume.pdf', 'old.pdf'],
            identityVersions: [V1],
            posts: [{ id: POST, slug: 'hello', published: true, banner_version: null }]
        });
        expect(await store.postMarkdown('posts/p/o.md')).toBe('# Hello');
        await expect(store.postMarkdown('posts/p/missing.md')).rejects.toBeInstanceOf(DataError);
    });

    test('clears content and the profile but keeps subscribers and queues post markdown', async () => {
        const { sqlite, store } = seeded();
        await store.clearAll();
        const count = (table: string) =>
            (sqlite.query(`select count(*) as n from ${table}`).get() as { n: number }).n;
        expect(count('db_posts')).toBe(0);
        expect(count('db_comments')).toBe(0);
        expect(count('db_legals')).toBe(0);
        expect(count('db_subscribers')).toBe(1);
        expect(sqlite.query('select storage_path from db_post_storage_cleanup').all()).toEqual([
            { storage_path: 'posts/p/o.md' }
        ]);
        expect(sqlite.query('select name, avatar_version from db_profiles').get()).toEqual({
            name: '',
            avatar_version: null
        });
        expect(
            sqlite.query('select count(*) as n from db_documents where is_active = 1').get()
        ).toEqual({ n: 0 });
        expect(
            sqlite
                .query(
                    'select retired_at is not null as retired from db_identity_versions where id = ?'
                )
                .get(V1)
        ).toEqual({ retired: 1 });
    });
});
