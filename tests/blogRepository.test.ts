import { describe, expect, test } from 'bun:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseBlogRepository, postFromRow } from '../packages/data/src/supabase/blog.ts';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const ID_A = 'a'.repeat(8) + '1'.repeat(56);
const ID_B = 'a'.repeat(8) + '2'.repeat(56);
const ID_C = 'c0ffee' + '3'.repeat(58);
const POST_UUID = '7f3c2a10-4b1d-4c8e-9a2f-0d1e2f3a4b5c';
const STORAGE_PATH = `posts/${POST_UUID}/0f8fad5b-d9cb-469f-a165-70867728950e.md`;

type Row = Record<string, unknown> & { public_id: string; slug: string; published: boolean };

const row = (overrides: Partial<Row>): Row => ({
    id: POST_UUID,
    public_id: ID_A,
    title: 'Hello',
    slug: 'hello',
    published: true,
    pinned: false,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: null,
    excerpt: null,
    tags: [],
    collaborators: [],
    summary: null,
    tldr: [],
    storage_path: STORAGE_PATH,
    banner_version: null,
    read_time: null,
    ...overrides
});

function fakeDb(rows: Row[], files: Record<string, string> = {}) {
    const db = {
        from: () => {
            const filters: Array<(row: Row) => boolean> = [];
            let max = Infinity;
            const result = () => rows.filter(row => filters.every(f => f(row))).slice(0, max);
            const builder = {
                select: () => builder,
                eq: (column: string, value: unknown) => {
                    filters.push(row => row[column] === value);
                    return builder;
                },
                like: (column: string, pattern: string) => {
                    const prefix = pattern.slice(0, -1);
                    filters.push(row => String(row[column]).startsWith(prefix));
                    return builder;
                },
                limit: (count: number) => {
                    max = count;
                    return builder;
                },
                maybeSingle: async () => ({ data: result()[0] ?? null, error: null }),
                then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
                    resolve({ data: result(), error: null })
            };
            return builder;
        },
        storage: {
            from: () => ({
                getPublicUrl: (path: string) => ({
                    data: { publicUrl: `https://storage.test/${path}` }
                })
            })
        }
    } as unknown as SupabaseClient;
    const fetchFn = (async (input: string | URL) => {
        const path = String(input).replace('https://storage.test/', '');
        return path in files ? new Response(files[path]) : new Response('missing', { status: 404 });
    }) as unknown as typeof fetch;
    return createSupabaseBlogRepository(db, { fetch: fetchFn, cdnBase: 'https://cdn.test' });
}

describe('postFromRow', () => {
    test('keeps only public fields and swaps the UUID for the public ID', () => {
        const post = postFromRow(
            row({
                tags: ['svelte', 3],
                collaborators: null,
                banner_version: '11111111-2222-3333-4444-555555555555',
                post_revision: 4
            }),
            'https://cdn.test'
        );
        expect(post.id).toBe(ID_A);
        expect(post.tags).toEqual(['svelte']);
        expect(post.collaborators).toEqual([]);
        expect(post.banner_url).toBe('https://cdn.test/blog/hello/banner.webp');
        expect(JSON.stringify(post)).not.toMatch(UUID);
        expect(Object.keys(post)).not.toContain('storage_path');
    });

    test('reports stored read minutes only when they are positive', () => {
        expect(postFromRow(row({ read_time: 7 }), undefined).read_minutes).toBe(7);
        expect(postFromRow(row({ read_time: 0 }), undefined).read_minutes).toBeNull();
        expect(postFromRow(row({}), undefined).banner_url).toBeNull();
    });
});

describe('findPublished', () => {
    const blog = fakeDb([
        row({ public_id: ID_A, slug: 'update-gnome-51' }),
        row({ public_id: ID_B, slug: 'second', published: true }),
        row({ public_id: ID_C, slug: 'c0ffee3' }),
        row({ public_id: 'd'.repeat(64), slug: 'draft', published: false })
    ]);

    test('finds a post by full public ID, slug and unique prefix', async () => {
        const byId = await blog.findPublished(ID_A);
        const bySlug = await blog.findPublished('update-gnome-51');
        const byPrefix = await blog.findPublished(ID_C.slice(0, 7));
        expect(byId.status === 'found' && byId.post.slug).toBe('update-gnome-51');
        expect(bySlug.status === 'found' && bySlug.post.id).toBe(ID_A);
        expect(byPrefix.status === 'found' && byPrefix.post.id).toBe(ID_C);
    });

    test('prefers an exact slug over an ID prefix', async () => {
        const result = await blog.findPublished('c0ffee3');
        expect(result.status === 'found' && result.post.slug).toBe('c0ffee3');
    });

    test('reports ambiguous prefixes, invalid references and drafts', async () => {
        expect(await blog.findPublished('aaaaaaaa')).toEqual({ status: 'ambiguous' });
        expect(await blog.findPublished('NOT VALID')).toEqual({ status: 'invalid' });
        expect(await blog.findPublished('draft')).toEqual({ status: 'not-found' });
        expect(await blog.getPublishedBySlug('draft')).toBeNull();
    });
});

describe('post content', () => {
    test('reads the markdown and the stored render through the post source', async () => {
        const blog = fakeDb([row({})], {
            [STORAGE_PATH]: '# Hello',
            [STORAGE_PATH.replace(/\.md$/, '.render.json')]: '{"version":1}'
        });
        const post = await blog.getPublishedBySlug('hello');
        expect(post).not.toBeNull();
        expect(await blog.readMarkdown(post!.source)).toBe('# Hello');
        expect(await blog.readRender(post!.source)).toBe('{"version":1}');
    });

    test('returns null when the file is missing', async () => {
        const blog = fakeDb([row({ storage_path: null })]);
        const post = await blog.getPublishedBySlug('hello');
        expect(await blog.readMarkdown(post!.source)).toBeNull();
        expect(await blog.readRender(post!.source)).toBeNull();
    });
});
