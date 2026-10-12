import { describe, expect, mock, test } from 'bun:test';
import type { SupabaseClient } from '@supabase/supabase-js';

mock.module('$app/env/public', () => ({}));
mock.module('#lib/author.ts', () => ({
    fetchAuthorProfile: async () => ({ id: 'a1b2c3d4-0000-4000-8000-000000000000', name: 'A' }),
    fetchContactInfo: async () => [{ id: 'x', platform: 'Email', href: 'mailto:a@b.c' }],
    fetchCvEntries: async () => ({
        experiences: [{ id: 'f0e1d2c3-0000-4000-8000-000000000000', title: 'Engineer' }]
    }),
    fetchFundingLinks: async () => [],
    fetchGroupedSkills: async () => [],
    fetchSocials: async () => [],
    fetchActiveCvDocument: async () => ({
        fileUrl: 'https://storage.test/cv.pdf',
        filename: 'cv.pdf'
    })
}));

const { getAuthor } = await import('../packages/lib/src/server/api/author.ts');
const { buildCommentTree } = await import('../packages/lib/src/server/api/blog.ts');
const { runApi } = await import('../packages/lib/src/server/api/responses.ts');

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const PDF = new TextEncoder().encode('%PDF-1.7 test');

const fakeFetch = (async () => new Response(PDF)) as unknown as typeof fetch;

function ctx(path: string, accept?: string) {
    const url = new URL(`https://fkp.my.id${path}`);
    return {
        url,
        request: new Request(url, accept ? { headers: { Accept: accept } } : undefined),
        db: {} as SupabaseClient,
        fetch: fakeFetch
    };
}

describe('author and CV endpoints', () => {
    test('/cv returns exactly what /author?field=cv returns', async () => {
        const viaCv = await runApi(() => getAuthor(ctx('/api/v1/cv'), ['cv']));
        const viaAuthor = await runApi(() => getAuthor(ctx('/api/v1/author?field=cv')));
        expect(viaCv.status).toBe(200);
        expect(await viaCv.text()).toBe(await viaAuthor.text());
        expect([...viaCv.headers]).toEqual([...viaAuthor.headers]);
    });

    test('never returns database IDs', async () => {
        const response = await runApi(() => getAuthor(ctx('/api/v1/author')));
        const body = await response.text();
        expect(body).not.toMatch(UUID);
        expect(JSON.parse(body)).toHaveProperty('profile.name', 'A');
    });

    test('downloads the PDF with checksum headers by default', async () => {
        const response = await runApi(() => getAuthor(ctx('/api/v1/cv?o=pdf'), ['cv']));
        expect(response.headers.get('content-type')).toBe('application/pdf');
        expect(response.headers.get('content-disposition')).toBe('attachment; filename="cv.pdf"');
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', PDF));
        const hex = Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
        expect(response.headers.get('x-checksum-sha256')).toBe(hex);
        expect(response.headers.get('repr-digest')).toBe(
            `sha-256=:${btoa(String.fromCharCode(...digest))}:`
        );
        const same = await runApi(() => getAuthor(ctx('/api/v1/author?f=cv&o=pdf&c=true')));
        expect(same.headers.get('x-checksum-sha256')).toBe(hex);
    });

    test('omits checksum headers when checksum=false', async () => {
        const response = await runApi(() => getAuthor(ctx('/api/v1/cv?o=pdf&c=false'), ['cv']));
        expect(response.headers.get('content-type')).toBe('application/pdf');
        expect(response.headers.has('x-checksum-sha256')).toBe(false);
        expect(response.headers.has('repr-digest')).toBe(false);
    });

    test('rejects checksum without PDF output and PDF for other fields', async () => {
        const noPdf = await runApi(() => getAuthor(ctx('/api/v1/cv?checksum=true'), ['cv']));
        expect(noPdf.status).toBe(400);
        expect((await noPdf.json()).code).toBe('CV_CHECKSUM_REQUIRES_PDF');

        const wrongField = await runApi(() => getAuthor(ctx('/api/v1/author?f=profile&o=pdf')));
        expect((await wrongField.json()).code).toBe('OUTPUT_UNSUPPORTED');

        const unknown = await runApi(() => getAuthor(ctx('/api/v1/author?f=hobbies')));
        expect((await unknown.json()).code).toBe('AUTHOR_FIELD_INVALID');

        const fieldOnCv = await runApi(() => getAuthor(ctx('/api/v1/cv?f=cv'), ['cv']));
        expect((await fieldOnCv.json()).code).toBe('UNKNOWN_PARAMETER');
    });

    test('serves markdown when asked through output or Accept', async () => {
        const viaParam = await runApi(() => getAuthor(ctx('/api/v1/author?o=md')));
        const viaAccept = await runApi(() => getAuthor(ctx('/api/v1/author', 'text/markdown')));
        expect(viaParam.headers.get('content-type')).toContain('text/markdown');
        expect(await viaParam.text()).toBe(await viaAccept.text());
    });
});

describe('comment threads', () => {
    test('nests replies under their parent without exposing IDs', () => {
        const tree = buildCommentTree([
            {
                id: 'a',
                parent_id: null,
                author_name: 'Ann',
                content: 'First',
                is_anonymous: false,
                is_admin: false,
                created_at: '2026-10-01T00:00:00Z'
            },
            {
                id: 'b',
                parent_id: 'a',
                author_name: 'Bob',
                content: 'Reply',
                is_anonymous: null,
                is_admin: true,
                created_at: '2026-10-02T00:00:00Z'
            },
            {
                id: 'c',
                parent_id: 'missing',
                author_name: 'Cy',
                content: 'Orphan',
                is_anonymous: false,
                is_admin: false,
                created_at: '2026-10-03T00:00:00Z'
            }
        ]);
        expect(tree).toHaveLength(2);
        expect(tree[0].replies[0]).toEqual({
            author_name: 'Bob',
            content: 'Reply',
            is_admin: true,
            is_anonymous: false,
            created_at: '2026-10-02T00:00:00Z',
            replies: []
        });
        expect(JSON.stringify(tree)).not.toMatch(/"(id|parent_id|post_id)"/);
    });
});
