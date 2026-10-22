import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import postgresColumns from './fixtures/postgresColumns.json';

const MIGRATIONS = new URL('../packages/data/d1/migrations/', import.meta.url);
const MOVED_TO_POST_STATS = ['view_count', 'helpful_yes', 'helpful_no'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

type Row = Record<string, unknown>;

function migratedDb() {
    const db = new Database(':memory:');
    db.run('PRAGMA foreign_keys = ON');
    for (const file of readdirSync(MIGRATIONS)
        .filter(name => name.endsWith('.sql'))
        .sort())
        db.run(readFileSync(new URL(file, MIGRATIONS), 'utf8'));
    return db;
}

function columns(db: Database, table: string) {
    return (db.query(`select name from pragma_table_xinfo('${table}')`).all() as Row[]).map(
        row => row.name as string
    );
}

function generation(db: Database, domain: string) {
    return (
        db.query('select gen from db_cache_generations where domain = ?').get(domain) as Row | null
    )?.gen;
}

function profile(db: Database, id = 'p1') {
    db.query(
        `insert into db_profiles (id, name, username, headline, job_title, bio, avatar, email, city, postal_code, country, site_url)
         values (?, 'Ada', ?, 'h', 'j', 'b', 'a', ?, 'c', '1', 'ID', 'https://example.com')`
    ).run(id, `ada-${id}`, `${id}@example.com`);
    return id;
}

function post(db: Database, id: string, values: Row = {}) {
    const row = {
        id,
        slug: `post-${id.replace(/[^a-z]/g, '')}`,
        title: 'Title',
        excerpt: 'Excerpt',
        published: 0,
        storage_path: `${id}.md`,
        pinned: 0,
        ...values
    };
    const keys = Object.keys(row);
    db.query(
        `insert into db_posts (${keys.join(', ')}) values (${keys.map(() => '?').join(', ')})`
    ).run(...(Object.values(row) as never[]));
}

describe('D1 schema', () => {
    test('keeps every Postgres column, with the post counters moved to db_post_stats', () => {
        const db = migratedDb();
        for (const [table, expected] of Object.entries(postgresColumns)) {
            const actual = columns(db, table);
            const wanted =
                table === 'db_posts' ?
                    expected.filter(name => !MOVED_TO_POST_STATS.includes(name))
                :   expected;
            expect({ table, missing: wanted.filter(name => !actual.includes(name)) }).toEqual({
                table,
                missing: []
            });
        }
        expect(columns(db, 'db_post_stats')).toEqual(['post_id', ...MOVED_TO_POST_STATS]);
    });

    test('generates UUIDs, public IDs and ISO timestamps by default', () => {
        const db = migratedDb();
        profile(db);
        post(db, 'a');
        const row = db.query('select public_id, created_at from db_posts').get() as Row;
        expect(row.public_id).toMatch(/^[0-9a-f]{64}$/);
        expect(row.created_at).toMatch(TIMESTAMP);
        db.query("insert into db_legals (slug, title) values ('terms', 'Terms')").run();
        expect((db.query('select id from db_legals').get() as Row).id).toMatch(UUID);
    });

    test('rejects values the Postgres constraints rejected', () => {
        const db = migratedDb();
        expect(() => post(db, 'a', { slug: 'Bad Slug' })).toThrow();
        for (const slug of ['-lead', 'trail-', 'double--dash', 'content'])
            expect(() => post(db, `x${slug}`, { slug })).toThrow();
        post(db, 'svelte', { slug: 'svelte-5-2' });
        expect(() => post(db, 'b', { title: 'x'.repeat(61) })).toThrow();
        expect(() =>
            post(db, 'c', { tags: JSON.stringify(['a', 'b', 'c', 'd', 'e', 'f']) })
        ).toThrow();
        expect(() => post(db, 'd', { tags: JSON.stringify(['x'.repeat(31)]) })).toThrow('Tags');
        expect(() => post(db, 'e', { published: 1, excerpt: '  ' })).toThrow('Excerpt');
        post(db, 'f', { tags: JSON.stringify(['svelte']), tldr: JSON.stringify(['short']) });
        expect(() =>
            db.query("update db_posts set public_id = ? where id = 'f'").run('a'.repeat(64))
        ).toThrow('immutable');
    });

    test('counts post revisions only for content changes and caps pinned posts at three', () => {
        const db = migratedDb();
        post(db, 'a');
        db.query("update db_posts set title = 'New' where id = 'a'").run();
        db.query("update db_posts set subscribers_notified_at = 'now' where id = 'a'").run();
        expect(
            (db.query("select post_revision from db_posts where id = 'a'").get() as Row)
                .post_revision
        ).toBe(1);
        for (const id of ['p', 'q', 'r']) post(db, id, { pinned: 1 });
        expect(() => post(db, 's', { pinned: 1 })).toThrow('Maximum of 3 pinned posts allowed');
        expect(() => db.query("update db_posts set pinned = 1 where id = 'a'").run()).toThrow(
            'Maximum of 3 pinned posts allowed'
        );
    });

    test('derives CV dates from month and year', () => {
        const db = migratedDb();
        profile(db);
        db.query(
            `insert into db_experiences (author_id, title, type, company, start_month, start_year, end_month, end_year, location, loc_type, description)
             values ('p1', 't', 'full', 'c', 'March', 2024, NULL, NULL, 'l', 'remote', 'd')`
        ).run();
        expect(db.query('select start_date, end_date from db_experiences').get()).toEqual({
            start_date: '2024-03-01',
            end_date: null
        });
    });

    test('increments the profile revision and caps links per category', () => {
        const db = migratedDb();
        profile(db);
        db.query("update db_profiles set bio = 'new' where id = 'p1'").run();
        expect(
            (db.query('select profile_revision from db_profiles').get() as Row).profile_revision
        ).toBe(1);
        const link = db.query(
            "insert into db_links (author_id, category, platform, url) values ('p1', 'social', 'x', 'https://example.com')"
        );
        for (let index = 0; index < 10; index++) link.run();
        expect(() => link.run()).toThrow('LINK_CATEGORY_LIMIT');
    });

    test('raises admin notifications once and keeps view counts in db_post_stats', () => {
        const db = migratedDb();
        post(db, 'a');
        db.query(
            "insert into db_comments (id, post_id, author_name, content) values ('c1', 'a', 'Bob', 'Hi')"
        ).run();
        db.query(
            "insert into db_comments (id, post_id, author_name, content, is_admin) values ('c2', 'a', 'Me', 'Reply', 1)"
        ).run();
        db.query("insert into db_comment_reports (comment_id, reason) values ('c1', 'spam')").run();
        const kinds = db
            .query('select kind, meta from db_admin_notifications order by kind')
            .all() as Row[];
        expect(kinds.map(row => row.kind)).toEqual(['comment_new', 'comment_report']);
        expect(JSON.parse(kinds[0].meta as string)).toMatchObject({
            author: 'Bob',
            page_title: 'Title'
        });
        db.query("insert into db_views (post_id, ip_hash) values ('a', 'h1')").run();
        db.query("insert into db_views (post_id, ip_hash) values ('a', 'h2')").run();
        db.query("delete from db_views where ip_hash = 'h1'").run();
        expect(
            (db.query("select view_count from db_post_stats where post_id = 'a'").get() as Row)
                .view_count
        ).toBe(1);
    });

    test('bumps the cache generation of the domain a write touches', () => {
        const db = migratedDb();
        const blog = generation(db, 'blog');
        const author = generation(db, 'author');
        post(db, 'a');
        expect(generation(db, 'blog')).toBe((blog as number) + 1);
        db.query("insert into db_views (post_id, ip_hash) values ('a', 'h')").run();
        expect(generation(db, 'blog')).toBe((blog as number) + 1);
        profile(db);
        expect(generation(db, 'author')).toBe((author as number) + 1);
        db.query(
            "insert into db_comments (post_id, author_name, content) values ('a', 'Bob', 'Hi')"
        ).run();
        expect(generation(db, 'comments:a')).toBe(1);
        expect(generation(db, 'legal')).toBe(0);
    });
});
