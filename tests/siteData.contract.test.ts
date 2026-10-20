import { describe, expect, test } from 'bun:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseSiteDataStore } from '../packages/data/src/supabase/siteData.ts';
import { DataError } from '../packages/data/src/errors.ts';
import { fakeSupabase, type FakeTables } from './support/fakeSupabase.ts';

const PROFILE = '00000000-0000-4000-8000-000000000001';
const POST = '00000000-0000-4000-8000-000000000002';

function tables(): FakeTables {
    return {
        db_profiles: [{ id: PROFILE, avatar_version: 'avatar-1' }],
        db_posts: [
            {
                id: POST,
                slug: 'hello',
                title: 'Hello',
                published: true,
                banner_version: 'banner-1',
                storage_path: 'posts/p/o.md',
                view_count: 4,
                created_at: '2026-10-01T00:00:00Z'
            }
        ],
        db_comments: [{ id: 'c1', post_id: POST, content: 'hi' }],
        db_comment_reports: [{ comment_id: 'c1', reason: 'spam', created_at: '2026-10-02' }],
        db_feedback_events: [],
        db_legals: [{ slug: 'terms', title: 'Terms', content: '# Terms' }],
        db_project_repo_rules: [{ rule_type: 'pin', repo_name: 'repo', sort_order: 1 }],
        db_documents: [
            { filename: 'cv.pdf', hash: 'h', is_active: true, author_id: PROFILE },
            { filename: 'old.pdf', hash: 'o', is_active: false, author_id: PROFILE }
        ],
        db_identity_versions: [
            { id: 'v1', profile_id: PROFILE },
            { id: 'v2', profile_id: 'someone-else' }
        ],
        db_admin_settings: [{ user_id: 'u', settings: { theme: 'dark' } }]
    };
}

function failing(db: SupabaseClient, table: string): SupabaseClient {
    return {
        ...db,
        from: (name: string) =>
            name === table ?
                ({
                    select: () => ({
                        then: (resolve: (value: unknown) => unknown) =>
                            Promise.resolve({ data: null, error: { message: 'down' } }).then(
                                resolve
                            )
                    })
                } as never)
            :   db.from(name)
    } as SupabaseClient;
}

describe('Supabase site data adapter', () => {
    test('collects every export table and the avatar version', async () => {
        const { db } = fakeSupabase(tables());
        const { tables: data, failures } = await createSupabaseSiteDataStore(db).exportTables();
        expect(failures).toEqual([]);
        expect(data.posts.map(post => [post.slug, post.view_count])).toEqual([['hello', 4]]);
        expect(data.comments).toHaveLength(1);
        expect(data.activeDocuments.map(doc => doc.filename)).toEqual(['cv.pdf']);
        expect(data.settings).toEqual([{ user_id: 'u', settings: { theme: 'dark' } }]);
        expect(data.avatarVersion).toBe('avatar-1');
    });

    test('reports a failing table as a scoped failure and keeps the rest', async () => {
        const { db } = fakeSupabase(tables());
        const { tables: data, failures } = await createSupabaseSiteDataStore(
            failing(db, 'db_comments')
        ).exportTables();
        expect(failures).toEqual([{ scope: 'comments', error: { message: 'down' } }]);
        expect(data.comments).toEqual([]);
        expect(data.posts).toHaveLength(1);
    });

    test('plans a delete from the profile files and every post', async () => {
        const { db } = fakeSupabase(tables());
        expect(await createSupabaseSiteDataStore(db).deletionPlan()).toEqual({
            documents: ['cv.pdf', 'old.pdf'],
            identityVersions: ['v1'],
            posts: [{ id: POST, slug: 'hello', published: true, banner_version: 'banner-1' }]
        });
    });

    test('a site without a profile only plans its posts', async () => {
        const seed = tables();
        seed.db_profiles = [];
        const { db } = fakeSupabase(seed);
        const plan = await createSupabaseSiteDataStore(db).deletionPlan();
        expect(plan.documents).toEqual([]);
        expect(plan.identityVersions).toEqual([]);
        expect(plan.posts).toHaveLength(1);
    });

    test('reads post markdown and clears all data through the database function', async () => {
        let cleared = 0;
        const { db } = fakeSupabase(
            tables(),
            { 'posts/p/o.md': '# Hello' },
            {
                rpc: {
                    db_clear_all_data: () => {
                        cleared++;
                        return { data: null, error: null };
                    }
                }
            }
        );
        const store = createSupabaseSiteDataStore(db);
        expect(await store.postMarkdown('posts/p/o.md')).toBe('# Hello');
        await expect(store.postMarkdown('posts/p/missing.md')).rejects.toBeInstanceOf(DataError);
        await store.clearAll();
        expect(cleared).toBe(1);
    });
});
