import { describe, expect, test } from 'bun:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { findPost, resolvePostUuid } from '../src/lib/server/postLookup.ts';
import { isValidPostSlug, planSlugRegeneration, slugifyTitle } from '../src/lib/slug.ts';

type Row = { id: string; public_id: string; slug: string; published: boolean };

const ID_A = 'a'.repeat(8) + '1'.repeat(56);
const ID_B = 'a'.repeat(8) + '2'.repeat(56);
const ID_C = 'c0ffee' + '3'.repeat(58);

const rows: Row[] = [
    { id: 'uuid-a', public_id: ID_A, slug: 'update-gnome-51', published: true },
    { id: 'uuid-b', public_id: ID_B, slug: 'draft-post', published: false },
    { id: 'uuid-c', public_id: ID_C, slug: 'c0ffee3', published: true }
];

function fakeDb(): SupabaseClient {
    return {
        from: () => {
            const filters: Array<(row: Row) => boolean> = [];
            let max = Infinity;
            const builder = {
                select: () => builder,
                eq: (column: keyof Row, value: unknown) => {
                    filters.push(row => row[column] === value);
                    return builder;
                },
                like: (column: keyof Row, pattern: string) => {
                    const prefix = pattern.slice(0, -1);
                    filters.push(row => String(row[column]).startsWith(prefix));
                    return builder;
                },
                limit: (count: number) => {
                    max = count;
                    return builder;
                },
                then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
                    resolve({
                        data: rows.filter(row => filters.every(f => f(row))).slice(0, max),
                        error: null
                    })
            };
            return builder;
        }
    } as unknown as SupabaseClient;
}

describe('post slugs', () => {
    test('keeps numbers from the title', () => {
        expect(slugifyTitle('Update GNOME 51')).toBe('update-gnome-51');
        expect(slugifyTitle("October Is One of Linux's Best Months")).toBe(
            'october-is-one-of-linuxs-best-months'
        );
        expect(slugifyTitle('  Café -- 2026 / Recap ')).toBe('cafe-2026-recap');
    });

    test('accepts lowercase alphanumeric slugs only', () => {
        expect(isValidPostSlug('update-gnome-51')).toBe(true);
        expect(isValidPostSlug('2026')).toBe(true);
        expect(isValidPostSlug('Update-GNOME')).toBe(false);
        expect(isValidPostSlug('bad--slug')).toBe(false);
        expect(isValidPostSlug('-lead')).toBe(false);
        expect(isValidPostSlug('a'.repeat(101))).toBe(false);
    });
});

describe('slug regeneration plan', () => {
    test('restores numbers and leaves matching slugs alone', () => {
        expect(
            planSlugRegeneration([
                { id: '1', title: 'Update GNOME 51', slug: 'update-gnome' },
                { id: '2', title: 'Hello World', slug: 'hello-world' }
            ])
        ).toEqual([
            { id: '1', title: 'Update GNOME 51', from: 'update-gnome', to: 'update-gnome-51' }
        ]);
    });

    test('suffixes collisions in creation order', () => {
        expect(
            planSlugRegeneration([
                { id: '1', title: 'Recap 2026', slug: 'recap' },
                { id: '2', title: 'Recap 2026!', slug: 'recap-again' }
            ]).map(change => change.to)
        ).toEqual(['recap-2026', 'recap-2026-2']);
    });
});

describe('findPost', () => {
    const db = fakeDb();

    test('finds a post by its full public ID', async () => {
        expect(await findPost(db, ID_A, '*')).toEqual({ status: 'found', post: rows[0] });
    });

    test('finds a post by slug', async () => {
        expect(await findPost(db, 'update-gnome-51', '*')).toEqual({
            status: 'found',
            post: rows[0]
        });
    });

    test('finds a post by a unique ID prefix of at least seven characters', async () => {
        expect(await findPost(db, ID_A.slice(0, 7), '*')).toEqual({
            status: 'found',
            post: rows[0]
        });
    });

    test('prefers an exact slug over an ID prefix', async () => {
        expect(await findPost(db, 'c0ffee3', '*')).toEqual({ status: 'found', post: rows[2] });
    });

    test('reports an ambiguous prefix', async () => {
        expect(await findPost(db, 'aaaaaaaa', '*', { publishedOnly: false })).toEqual({
            status: 'ambiguous'
        });
    });

    test('hides unpublished posts by default', async () => {
        expect(await findPost(db, 'draft-post', '*')).toEqual({ status: 'not-found' });
        expect(await findPost(db, 'aaaaaaaa', '*')).toEqual({ status: 'found', post: rows[0] });
    });

    test('rejects references that are neither IDs nor slugs', async () => {
        expect(await findPost(db, "x' or 1=1", '*')).toEqual({ status: 'invalid' });
        expect(await findPost(db, 'abc%', '*')).toEqual({ status: 'invalid' });
    });

    test('resolves only full public IDs to internal UUIDs', async () => {
        expect(await resolvePostUuid(db, ID_A)).toBe('uuid-a');
        expect(await resolvePostUuid(db, 'update-gnome-51')).toBeNull();
        expect(await resolvePostUuid(db, ID_B)).toBeNull();
        expect(await resolvePostUuid(db, ID_B, { publishedOnly: false })).toBe('uuid-b');
    });
});
