// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { Database } from 'bun:sqlite';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { faker } from '@faker-js/faker';

export const SEED_PROFILES = {
    small: {
        posts: 10,
        comments: 80,
        reports: 20,
        feedback: 120,
        views: 3_000,
        activity: 400,
        subscribers: 50
    },
    large: {
        posts: 60,
        comments: 3_000,
        reports: 600,
        feedback: 8_000,
        views: 60_000,
        activity: 12_000,
        subscribers: 3_000
    },
    huge: {
        posts: 250,
        comments: 25_000,
        reports: 6_000,
        feedback: 40_000,
        views: 250_000,
        activity: 60_000,
        subscribers: 25_000
    }
} as const;

export type SeedProfile = keyof typeof SEED_PROFILES;
type Counts = (typeof SEED_PROFILES)[SeedProfile];

const REPORT_REASONS = [
    'spam',
    'harassment',
    'violence_or_illegal',
    'sexual_content',
    'self_harm',
    'impersonation',
    'removal_request',
    'misinformation',
    'other'
];
const LEGAL_PAGES = [
    ['privacy', 'Privacy Policy'],
    ['terms', 'Terms of Service'],
    ['security', 'Security Policy'],
    ['ai-disclosure', 'AI Disclosure']
] as const;
const ACTIONS = [
    ['blog.publish', 'blog', 'Published a post.'],
    ['blog.update', 'blog', 'Updated a post.'],
    ['blog.unpublish', 'blog', 'Unpublished a post.'],
    ['blog.comment_delete', 'blog', 'Deleted a comment.'],
    ['blog.pin', 'blog', 'Pinned a post.'],
    ['newsletter.subscriber_delete', 'blog', 'Deleted a newsletter subscriber.'],
    ['auth.login', 'security', 'Signed in.'],
    ['auth.logout', 'security', 'Signed out.'],
    ['profile.update', 'profile', 'Updated the profile.'],
    ['profile.avatar_update', 'profile', 'Updated the profile image.'],
    ['legal.update', 'profile', 'Updated a legal page.'],
    ['resume.entries_update', 'resume', 'Saved resume entries.'],
    ['resume.upload', 'resume', 'Generated the resume document.'],
    ['resume.signature_upload', 'resume', 'Uploaded a verified resume signature.'],
    ['resume.openpgp_key', 'resume', 'Updated the OpenPGP key keyservers.'],
    ['skills.update', 'skills', 'Saved skill categories.'],
    ['links.update', 'links', 'Saved links.'],
    ['settings.analytics', 'settings', 'Updated the analytics settings.']
] as const;

const DAY = 86_400_000;

function hex(length: number) {
    return faker.string.hexadecimal({ length, casing: 'lower', prefix: '' });
}

function pastDate(now: number, days = 365) {
    const ageDays = Math.floor(days * Math.random() ** 2);
    return new Date(now - ageDays * DAY - faker.number.int(DAY - 1)).toISOString();
}

function slugify(text: string) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80)
        .replace(/-$/, '');
}

export function contentTables(db: Database): string[] {
    return (
        db
            .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'db_%'")
            .all() as { name: string }[]
    ).map(row => row.name);
}

export function emptyDatabase(db: Database) {
    db.exec('PRAGMA foreign_keys = OFF');
    const tables = contentTables(db);
    const remaining = () =>
        tables.some(table => (db.query(`SELECT 1 FROM "${table}" LIMIT 1`).get() ?? null) !== null);
    for (let pass = 0; pass < 5 && remaining(); pass++) {
        db.transaction(() => {
            for (const table of tables) db.exec(`DELETE FROM "${table}"`);
        })();
    }
}

type Post = { id: string; title: string };
type SeedComment = { id: string; postId: string };
type Template = {
    storage_path: string;
    banner_path: string | null;
    banner_version: string | null;
} | null;

function seedPosts(db: Database, count: number, template: Template, now: number) {
    const insert = db.prepare(
        `INSERT INTO db_posts (id, slug, title, excerpt, published, storage_path, banner_path, banner_version,
         read_time, tags, collaborators, pinned, created_at, updated_at, public_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 0, ?, ?, ?)`
    );
    for (let index = 0; index < count; index++) {
        const title = faker.lorem.sentence({ min: 3, max: 7 }).replace(/\.$/, '').slice(0, 60);
        const created = pastDate(now);
        const tags = faker.helpers.uniqueArray(
            () => faker.word.noun(),
            faker.number.int({ min: 1, max: 5 })
        );
        insert.run(
            faker.string.uuid(),
            `seed-${index + 1}-${slugify(title)}`,
            title,
            faker.lorem.sentences({ min: 1, max: 2 }).slice(0, 250),
            Math.random() < 0.85 ? 1 : 0,
            template?.storage_path ?? `posts/seed/${index + 1}.md`,
            template?.banner_path ?? null,
            template?.banner_version ?? null,
            faker.number.int({ min: 1, max: 25 }),
            JSON.stringify(tags),
            created,
            created,
            hex(64)
        );
    }
}

function seedComments(db: Database, count: number, posts: Post[], now: number): SeedComment[] {
    const insert = db.prepare(
        `INSERT INTO db_comments (id, post_id, author_name, content, is_approved, created_at, parent_id, is_anonymous, is_admin, public_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const comments: SeedComment[] = [];
    const recentByPost = new Map<string, string[]>();
    for (let index = 0; index < count; index++) {
        const post = faker.helpers.arrayElement(posts);
        const recent = recentByPost.get(post.id) ?? [];
        const parentId =
            recent.length && Math.random() < 0.25 ? faker.helpers.arrayElement(recent) : null;
        const id = faker.string.uuid();
        insert.run(
            id,
            post.id,
            faker.person.firstName(),
            faker.lorem.sentences({ min: 1, max: 4 }),
            Math.random() < 0.9 ? 1 : 0,
            pastDate(now),
            parentId,
            Math.random() < 0.1 ? 1 : 0,
            Math.random() < 0.03 ? 1 : 0,
            hex(64)
        );
        comments.push({ id, postId: post.id });
        recentByPost.set(post.id, [...recent.slice(-19), id]);
    }
    return comments;
}

function seedReports(db: Database, count: number, comments: SeedComment[], now: number) {
    const insert = db.prepare(
        'INSERT INTO db_comment_reports (id, comment_id, reason, details, reporter_ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (let index = 0; index < count && comments.length; index++) {
        insert.run(
            faker.string.uuid(),
            faker.helpers.arrayElement(comments).id,
            faker.helpers.arrayElement(REPORT_REASONS),
            Math.random() < 0.4 ? faker.lorem.sentence() : null,
            hex(64),
            pastDate(now)
        );
    }
}

function seedFeedback(db: Database, count: number, posts: Post[], now: number) {
    const insert = db.prepare(
        `INSERT INTO db_feedback_events (id, target_type, target_id, post_id, page_title, vote, ip_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (let index = 0; index < count; index++) {
        const vote = Math.random() < 0.7 ? 'yes' : 'no';
        const post = Math.random() < 0.8 ? faker.helpers.arrayElement(posts) : null;
        const [slug, title] = faker.helpers.arrayElement(LEGAL_PAGES);
        insert.run(
            faker.string.uuid(),
            post ? 'article' : 'legal',
            post?.id ?? slug,
            post?.id ?? null,
            post?.title ?? title,
            vote,
            hex(64),
            pastDate(now)
        );
    }
}

function seedViews(db: Database, count: number, posts: Post[], now: number) {
    const insert = db.prepare(
        'INSERT INTO db_views (id, post_id, ip_hash, viewed_at) VALUES (?, ?, ?, ?)'
    );
    for (let index = 0; index < count; index++) {
        insert.run(
            faker.string.uuid(),
            faker.helpers.arrayElement(posts).id,
            hex(64),
            pastDate(now)
        );
    }
    db.exec(`INSERT OR REPLACE INTO db_post_stats (post_id, view_count, helpful_yes, helpful_no)
             SELECT p.id,
                    (SELECT count(*) FROM db_views v WHERE v.post_id = p.id),
                    (SELECT count(*) FROM db_feedback_events f WHERE f.post_id = p.id AND f.vote = 'yes'),
                    (SELECT count(*) FROM db_feedback_events f WHERE f.post_id = p.id AND f.vote = 'no')
             FROM db_posts p`);
}

function seedActivity(db: Database, count: number, posts: Post[], now: number) {
    const insert = db.prepare(
        `INSERT INTO db_activity_log (id, actor, action, category, entity_id, summary, details, ip_hash, user_agent, created_at, ip)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`
    );
    for (let index = 0; index < count; index++) {
        const [action, category, summary] = faker.helpers.arrayElement(ACTIONS);
        insert.run(
            faker.string.uuid(),
            'admin@example.com',
            action,
            category,
            category === 'blog' ? faker.helpers.arrayElement(posts).id : null,
            summary,
            hex(64),
            faker.internet.userAgent(),
            pastDate(now, 30),
            faker.internet.ipv6()
        );
    }
}

function seedSubscribers(db: Database, count: number, now: number) {
    const insert = db.prepare(
        `INSERT INTO db_subscribers (id, email, status, unsubscribe_token, confirm_sent_at, confirmed_at, unsubscribed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (let index = 0; index < count; index++) {
        const email = `${index}.${faker.internet.email({ provider: 'example.com' }).toLowerCase()}`;
        const status = faker.helpers.weightedArrayElement([
            { value: 'active', weight: 7 },
            { value: 'pending', weight: 2 },
            { value: 'unsubscribed', weight: 1 }
        ]);
        const created = pastDate(now);
        insert.run(
            faker.string.uuid(),
            email,
            status,
            hex(64),
            created,
            status === 'pending' ? null : created,
            status === 'unsubscribed' ? created : null,
            created,
            created
        );
    }
}

export function seedDatabase(db: Database, counts: Counts, seed = 42, now = Date.now()) {
    faker.seed(seed);
    db.exec('PRAGMA foreign_keys = OFF');
    const template = db
        .query(
            'SELECT storage_path, banner_path, banner_version FROM db_posts ORDER BY published DESC, updated_at DESC LIMIT 1'
        )
        .get() as Template;
    db.transaction(() => {
        seedPosts(db, counts.posts, template, now);
        const posts = db
            .query('SELECT id, title FROM db_posts WHERE published = 1')
            .all() as Post[];
        if (posts.length) {
            const comments = seedComments(db, counts.comments, posts, now);
            seedReports(db, counts.reports, comments, now);
            seedFeedback(db, counts.feedback, posts, now);
            seedViews(db, counts.views, posts, now);
            seedActivity(db, counts.activity, posts, now);
        }
        db.exec(
            'UPDATE db_admin_notifications SET read_at = created_at WHERE abs(random()) % 10 < 6'
        );
        seedSubscribers(db, counts.subscribers, now);
    })();
}

function localDatabasePath(root: string) {
    const dir = join(root, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
    const file = existsSync(dir)
        ? readdirSync(dir).find(name => name.endsWith('.sqlite') && name !== 'metadata.sqlite')
        : undefined;
    if (!file) throw new Error('No local D1 database. Run `bun run db:local` first.');
    return join(dir, file);
}

function restoreBaseline(db: Database, baseline: string) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec(`ATTACH DATABASE '${baseline.replaceAll("'", "''")}' AS baseline`);
    db.transaction(() => {
        for (const table of contentTables(db)) {
            const columns = (
                db.query(`PRAGMA main.table_info("${table}")`).all() as { name: string }[]
            )
                .map(column => `"${column.name}"`)
                .join(', ');
            db.exec(`DELETE FROM main."${table}"`);
            db.exec(
                `INSERT INTO main."${table}" (${columns}) SELECT ${columns} FROM baseline."${table}"`
            );
        }
    })();
    db.exec('DETACH DATABASE baseline');
}

if (import.meta.main) {
    const mode = process.argv[2];
    const modes = ['empty', 'restore', ...Object.keys(SEED_PROFILES)];
    if (!mode || !modes.includes(mode)) {
        console.error(`Usage: bun run seed:local <${modes.join('|')}>`);
        process.exit(1);
    }
    const root = join(import.meta.dir, '..');
    const path = localDatabasePath(root);
    const baseline = join(root, '.wrangler/state/seed-baseline.sqlite');
    const db = new Database(path);
    if (!existsSync(baseline)) {
        db.exec(`VACUUM INTO '${baseline.replaceAll("'", "''")}'`);
        console.log(`Saved the current local data as ${baseline}.`);
    }
    restoreBaseline(db, baseline);
    if (mode === 'empty') emptyDatabase(db);
    else if (mode !== 'restore') seedDatabase(db, SEED_PROFILES[mode as SeedProfile]);
    const totals = contentTables(db)
        .map(
            table =>
                [
                    table,
                    (db.query(`SELECT count(*) AS n FROM "${table}"`).get() as { n: number }).n
                ] as const
        )
        .filter(([, n]) => n > 0)
        .map(([table, n]) => `${table}=${n}`);
    console.log(`Local D1 is now '${mode}': ${totals.join(', ') || 'no rows'}`);
    db.close();
}
