// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contentTables, emptyDatabase, seedDatabase } from './seedLocal.ts';

function migratedDatabase() {
    const db = new Database(':memory:');
    const dir = join(import.meta.dir, '../packages/data/d1/migrations');
    for (const file of readdirSync(dir)
        .filter(name => name.endsWith('.sql'))
        .sort()) {
        db.exec(readFileSync(join(dir, file), 'utf8'));
    }
    return db;
}

const COUNTS = {
    posts: 4,
    comments: 40,
    reports: 10,
    feedback: 30,
    views: 200,
    activity: 50,
    subscribers: 25
};

const count = (db: Database, table: string) =>
    (db.query(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;

test('seedDatabase fills every activity table with consistent rows', () => {
    const db = migratedDatabase();
    seedDatabase(db, COUNTS, 7, Date.UTC(2026, 10, 22));
    expect(count(db, 'db_posts')).toBe(4);
    expect(count(db, 'db_comments')).toBe(40);
    expect(count(db, 'db_comment_reports')).toBe(10);
    expect(count(db, 'db_feedback_events')).toBe(30);
    expect(count(db, 'db_views')).toBe(200);
    expect(count(db, 'db_activity_log')).toBe(50);
    const expected = (
        db
            .query(
                `SELECT (SELECT count(*) FROM db_comments WHERE is_admin = 0)
                      + (SELECT count(*) FROM db_comment_reports)
                      + (SELECT count(*) FROM db_feedback_events) AS n`
            )
            .get() as { n: number }
    ).n;
    expect(count(db, 'db_admin_notifications')).toBe(expected);
    expect(count(db, 'db_subscribers')).toBe(25);
    expect(db.query('PRAGMA foreign_key_check').all()).toEqual([]);
    const stats = db.query('SELECT sum(view_count) AS views FROM db_post_stats').get() as {
        views: number;
    };
    expect(stats.views).toBe(200);
});

test('emptyDatabase clears every content table', () => {
    const db = migratedDatabase();
    seedDatabase(db, COUNTS);
    emptyDatabase(db);
    for (const table of contentTables(db)) expect(count(db, table)).toBe(0);
});
