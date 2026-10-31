import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const MIGRATIONS = new URL('../packages/data/d1/migrations/', import.meta.url);
const files = [...new Bun.Glob('*.sql').scanSync(MIGRATIONS.pathname)].sort();
const migrate = (sqlite: Database, names: string[]) => {
    for (const file of names) sqlite.run(readFileSync(new URL(file, MIGRATIONS), 'utf8'));
};

describe('0008_drop_post_feedback', () => {
    test('keeps feedback events, their operations and the notify trigger', () => {
        const sqlite = new Database(':memory:');
        sqlite.run('PRAGMA foreign_keys = ON');
        const index = files.indexOf('0008_drop_post_feedback.sql');
        migrate(sqlite, files.slice(0, index));
        sqlite.run(
            `INSERT INTO db_feedback_events (id, target_type, target_id, page_title, vote, ip_hash)
             VALUES ('e1', 'legal', 'privacy', 'Privacy', 'yes', 'h')`
        );
        sqlite.run(
            `INSERT INTO db_feedback_operations (operation_id, target_type, target_id, vote, ip_hash, recorded, event_id)
             VALUES ('o1', 'legal', 'privacy', 'yes', 'h', 1, 'e1')`
        );
        migrate(sqlite, files.slice(index));

        expect(sqlite.query('select event_id from db_feedback_operations').all()).toEqual([
            { event_id: 'e1' }
        ]);
        expect(sqlite.query('select id, vote from db_feedback_events').all()).toEqual([
            { id: 'e1', vote: 'yes' }
        ]);
        const columns = sqlite.query('pragma table_info(db_feedback_events)').all() as {
            name: string;
        }[];
        expect(columns.map(column => column.name)).not.toContain('legacy_id');
        expect(
            sqlite
                .query(
                    "select name from sqlite_master where name in ('db_post_feedback', 'db_feedback_event_links')"
                )
                .all()
        ).toEqual([]);
        expect(sqlite.query('select page_url from db_admin_feedback_items').all()).toHaveLength(1);

        sqlite.run(
            `INSERT INTO db_feedback_events (id, target_type, target_id, page_title, vote, ip_hash)
             VALUES ('e2', 'legal', 'terms', 'Terms', 'no', 'h')`
        );
        expect(
            sqlite
                .query("select count(*) as n from db_admin_notifications where source_id = 'e2'")
                .get()
        ).toEqual({ n: 1 });
    });
});
