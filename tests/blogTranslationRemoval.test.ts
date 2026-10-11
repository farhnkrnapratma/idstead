import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const migration = await readFile(
    new URL('../supabase/migrations/20261008121447_remove_blog_translations.sql', import.meta.url),
    'utf8'
);

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
