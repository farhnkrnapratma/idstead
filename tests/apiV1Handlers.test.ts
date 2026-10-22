import { describe, expect, mock, test } from 'bun:test';
import { strFromU8, unzipSync } from 'fflate';

const FPR = '73C032AD78AC6F2E7CE781A27ABA82BF0C80A58C';
const cvDocument: Record<string, unknown> = {
    fileUrl: 'https://storage.test/cv/cv.pdf',
    filename: 'cv.pdf',
    version: '1.0',
    checksums: {
        sha256: 'a'.repeat(64),
        sha512: 'b'.repeat(128),
        md5: 'c'.repeat(32),
        b2: 'd'.repeat(128)
    },
    signedAt: '2026-10-17T00:00:00.000Z',
    signerFingerprint: FPR
};

mock.module('$app/env/public', () => ({}));
const authorRepository = {
    profile: async () => ({
        id: 'a1b2c3d4-0000-4000-8000-000000000000',
        name: 'A',
        avatar: 'https://example.com/avatar.png'
    }),
    contactLinks: async () => [{ id: 'x', platform: 'Email', href: 'mailto:a@b.c' }],
    cvEntries: async () => ({
        experiences: [{ id: 'f0e1d2c3-0000-4000-8000-000000000000', title: 'Engineer' }]
    }),
    fundingLinks: async () => [],
    skillGroups: async () => [],
    socialLinks: async () => [],
    activeCvDocument: async () => ({ ...cvDocument }),
    activeOpenPgpKey: async () => ({
        fingerprint: FPR,
        armored: '-----BEGIN PGP PUBLIC KEY BLOCK-----',
        algorithm: 'Ed25519',
        createdAt: null,
        expiresAt: null,
        userIds: [{ name: 'Ada', email: 'ada@example.com' }],
        keyservers: [{ label: 'keys.openpgp.org', url: 'https://keys.openpgp.org/x' }]
    })
};

const { getAuthor } = await import('../packages/lib/src/server/api/author.ts');
const { buildCommentTree } = await import('../packages/lib/src/server/api/blog.ts');
const { runApi } = await import('../packages/lib/src/server/api/responses.ts');

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const PDF = new TextEncoder().encode('%PDF-1.7 test');

const STORED: Record<string, BodyInit> = {
    'https://storage.test/cv/cv.pdf': PDF,
    'https://storage.test/cv/cv.pdf.asc': '-----BEGIN PGP SIGNATURE-----\n',
    'https://storage.test/cv/cv.pdf.sig': new Uint8Array([0x88, 0x75]),
    'https://storage.test/cv/cv-verify.zip': new Uint8Array([0x50, 0x4b, 0x03, 0x04])
};
const fakeFetch = (async (input: string | URL) => {
    const body = STORED[String(input)];
    return body === undefined ? new Response('missing', { status: 404 }) : new Response(body);
}) as unknown as typeof fetch;

function ctx(path: string, accept?: string) {
    const url = new URL(`https://example.com${path}`);
    return {
        url,
        request: new Request(url, accept ? { headers: { Accept: accept } } : undefined),
        repos: { author: authorRepository } as never,
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
        expect(JSON.parse(body)).toHaveProperty('profile.avatar', 'https://example.com/avatar.png');
    });

    test('downloads the PDF with checksum headers by default', async () => {
        const response = await runApi(() => getAuthor(ctx('/api/v1/cv?o=pdf'), ['cv']));
        expect(response.headers.get('content-type')).toBe('application/pdf');
        expect(response.headers.get('content-disposition')).toBe('attachment; filename="cv.pdf"');
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', PDF));
        const hex = Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
        expect(response.headers.get('x-checksum-sha256')).toBe(hex);
        const sha512 = new Uint8Array(await crypto.subtle.digest('SHA-512', PDF));
        expect(response.headers.get('repr-digest')).toBe(
            `sha-256=:${btoa(String.fromCharCode(...digest))}:, sha-512=:${btoa(String.fromCharCode(...sha512))}:`
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

    test('serves every verification file as a named attachment', async () => {
        const cases = [
            [
                'sha512',
                'cv.pdf.sha512',
                'text/plain; charset=utf-8',
                `${'b'.repeat(128)}  cv.pdf\n`
            ],
            ['b2', 'cv.pdf.b2', 'text/plain; charset=utf-8', `${'d'.repeat(128)}  cv.pdf\n`],
            ['asc', 'cv.pdf.asc', 'application/pgp-signature', '-----BEGIN PGP SIGNATURE-----\n'],
            ['sig', 'cv.pdf.sig', 'application/octet-stream', null],
            ['zip', 'cv-verify.zip', 'application/zip', null]
        ] as const;
        for (const [output, name, type, body] of cases) {
            const response = await runApi(() => getAuthor(ctx(`/api/v1/cv?o=${output}`), ['cv']));
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toBe(type);
            expect(response.headers.get('content-disposition')).toBe(
                `attachment; filename="${name}"`
            );
            if (body !== null) expect(await response.text()).toBe(body);
        }
        const zip = await runApi(() => getAuthor(ctx('/api/v1/cv?o=zip'), ['cv']));
        expect(zip.headers.get('repr-digest')).toContain('sha-256=:');
        const sums = await runApi(() => getAuthor(ctx('/api/v1/cv?o=md5&c=true'), ['cv']));
        expect((await sums.json()).code).toBe('CV_CHECKSUM_REQUIRES_PDF');
    });

    test('honors Want-Repr-Digest', async () => {
        const url = new URL('https://example.com/api/v1/cv?o=pdf');
        const response = await runApi(() =>
            getAuthor(
                {
                    ...ctx('/api/v1/cv?o=pdf'),
                    request: new Request(url, {
                        headers: { 'Want-Repr-Digest': 'sha-512=9, md5=10' }
                    })
                },
                ['cv']
            )
        );
        expect(response.headers.get('repr-digest')).toMatch(/^sha-512=:[^,]+:$/);
        expect(response.headers.has('x-checksum-sha256')).toBe(false);
    });

    test('assembles the bundle when none is stored yet', async () => {
        const stored = STORED['https://storage.test/cv/cv-verify.zip'];
        delete STORED['https://storage.test/cv/cv-verify.zip'];
        try {
            const response = await runApi(() => getAuthor(ctx('/api/v1/cv?o=zip'), ['cv']));
            expect(response.status).toBe(200);
            const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
            expect(Object.keys(files)).toContain('cv.pdf.sig');
            expect(files['cv.pdf']).toEqual(PDF);
            expect(strFromU8(files['cv.pdf.sha512'])).toBe(`${'b'.repeat(128)}  cv.pdf\n`);
            expect(strFromU8(files['VERIFY.txt'])).toContain('7ABA 82BF 0C80 A58C');
        } finally {
            STORED['https://storage.test/cv/cv-verify.zip'] = stored;
        }
    });

    test('keeps 502 for a PDF missing from storage and 404 for a bundle that cannot be built', async () => {
        const pdf = STORED['https://storage.test/cv/cv.pdf'];
        const zip = STORED['https://storage.test/cv/cv-verify.zip'];
        const checksums = cvDocument.checksums;
        delete STORED['https://storage.test/cv/cv.pdf'];
        delete STORED['https://storage.test/cv/cv-verify.zip'];
        cvDocument.checksums = null;
        try {
            const missingPdf = await runApi(() => getAuthor(ctx('/api/v1/cv?o=pdf'), ['cv']));
            expect(missingPdf.status).toBe(502);
            expect((await missingPdf.json()).code).toBe('CV_FETCH_FAILED');
            const missingZip = await runApi(() => getAuthor(ctx('/api/v1/cv?o=zip'), ['cv']));
            expect(missingZip.status).toBe(404);
            expect((await missingZip.json()).code).toBe('CV_BUNDLE_NOT_FOUND');
        } finally {
            STORED['https://storage.test/cv/cv.pdf'] = pdf;
            STORED['https://storage.test/cv/cv-verify.zip'] = zip;
            cvDocument.checksums = checksums;
        }
    });

    test('reports a missing signature', async () => {
        const signedAt = cvDocument.signedAt;
        cvDocument.signedAt = null;
        try {
            const response = await runApi(() => getAuthor(ctx('/api/v1/cv?o=sig'), ['cv']));
            expect(response.status).toBe(404);
            expect((await response.json()).code).toBe('CV_SIGNATURE_NOT_FOUND');
        } finally {
            cvDocument.signedAt = signedAt;
        }
    });

    test('describes the document, signer and key sources in JSON and markdown', async () => {
        const json = await (await runApi(() => getAuthor(ctx('/api/v1/cv'), ['cv']))).json();
        expect(json.cv.document.checksums.sha256).toBe('a'.repeat(64));
        expect(json.cv.document.signature.fingerprint).toBe(FPR);
        expect(json.cv.document.signature.signer).toEqual([
            { name: 'Ada', email: 'ada@example.com' }
        ]);
        expect(json.cv.document.files.sig).toBe('https://example.com/v1/cv?output=sig');
        expect(json.cv.document.publicKey.keyservers).toHaveLength(1);
        const md = await (await runApi(() => getAuthor(ctx('/api/v1/cv?o=md'), ['cv']))).text();
        expect(md).toContain('## CV Document');
        expect(md).toContain('7ABA 82BF 0C80 A58C');
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

    test('never reveals the stored name of an anonymous comment', () => {
        const [comment] = buildCommentTree([
            {
                id: 'a',
                parent_id: null,
                author_name: 'Real Name',
                content: 'Hidden author',
                is_anonymous: true,
                is_admin: false,
                created_at: '2026-10-01T00:00:00Z'
            }
        ]);
        expect(comment.author_name).toBe('Anonymous');
        expect(JSON.stringify(comment)).not.toContain('Real Name');
    });
});
