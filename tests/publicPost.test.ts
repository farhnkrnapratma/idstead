import { describe, expect, test } from 'bun:test';
import { publicPostFields } from '../packages/lib/src/publicPost.ts';

describe('publicPostFields', () => {
    test('keeps only the public columns and swaps the UUID for the public ID', () => {
        const fields = publicPostFields({
            id: '7f3c2a10-4b1d-4c8e-9a2f-0d1e2f3a4b5c',
            public_id: 'a'.repeat(64),
            title: 'Hello',
            slug: 'hello',
            pinned: true,
            published: true,
            created_at: '2026-10-01T00:00:00Z',
            updated_at: null,
            excerpt: 'Excerpt',
            tags: ['svelte', 3],
            collaborators: null,
            summary: null,
            tldr: ['one'],
            storage_path: 'posts/hello.md',
            banner_path: 'banners/x',
            banner_version: '11111111-2222-3333-4444-555555555555',
            post_revision: 4,
            subscribers_notified_at: '2026-10-02T00:00:00Z'
        });
        expect(fields).toEqual({
            id: 'a'.repeat(64),
            title: 'Hello',
            slug: 'hello',
            pinned: true,
            created_at: '2026-10-01T00:00:00Z',
            updated_at: null,
            excerpt: 'Excerpt',
            tags: ['svelte'],
            collaborators: [],
            summary: null,
            tldr: ['one']
        });
        expect(JSON.stringify(fields)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    });
});
