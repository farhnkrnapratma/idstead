import { describe, expect, mock, test } from 'bun:test';
import { strFromU8, unzipSync } from 'fflate';

const FPR = '73C032AD78AC6F2E7CE781A27ABA82BF0C80A58C';
const resumeDocument: Record<string, unknown> = {
    fileUrl: 'https://storage.test/resume/resume.pdf',
    filename: 'resume.pdf',
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
    resumeEntries: async () => ({
        experiences: [{ id: 'f0e1d2c3-0000-4000-8000-000000000000', title: 'Engineer' }]
    }),
    fundingLinks: async () => [],
    skillGroups: async () => [],
    socialLinks: async () => [],
    activeResumeDocument: async () => ({ ...resumeDocument }),
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
    'https://storage.test/resume/resume.pdf': PDF,
    'https://storage.test/resume/resume.pdf.asc': '-----BEGIN PGP SIGNATURE-----\n',
    'https://storage.test/resume/resume.pdf.sig': new Uint8Array([0x88, 0x75]),
    'https://storage.test/resume/resume-verify.zip': new Uint8Array([0x50, 0x4b, 0x03, 0x04])
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

describe('author and resume endpoints', () => {
    test('/resume returns exactly what /author?field=resume returns', async () => {
        const viaResume = await runApi(() => getAuthor(ctx('/api/v1/resume'), ['resume']));
        const viaAuthor = await runApi(() => getAuthor(ctx('/api/v1/author?field=resume')));
        expect(viaResume.status).toBe(200);
        expect(await viaResume.text()).toBe(await viaAuthor.text());
        expect([...viaResume.headers]).toEqual([...viaAuthor.headers]);
    });

    test('never returns database IDs', async () => {
        const response = await runApi(() => getAuthor(ctx('/api/v1/author')));
        const body = await response.text();
        expect(body).not.toMatch(UUID);
        expect(JSON.parse(body)).toHaveProperty('profile.name', 'A');
        expect(JSON.parse(body)).toHaveProperty('profile.avatar', 'https://example.com/avatar.png');
    });

    test('downloads the PDF with checksum headers by default', async () => {
        const response = await runApi(() => getAuthor(ctx('/api/v1/resume?o=pdf'), ['resume']));
        expect(response.headers.get('content-type')).toBe('application/pdf');
        expect(response.headers.get('content-disposition')).toBe(
            'attachment; filename="resume.pdf"'
        );
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', PDF));
        const hex = Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
        expect(response.headers.get('x-checksum-sha256')).toBe(hex);
        const sha512 = new Uint8Array(await crypto.subtle.digest('SHA-512', PDF));
        expect(response.headers.get('repr-digest')).toBe(
            `sha-256=:${btoa(String.fromCharCode(...digest))}:, sha-512=:${btoa(String.fromCharCode(...sha512))}:`
        );
        const same = await runApi(() => getAuthor(ctx('/api/v1/author?f=resume&o=pdf&c=true')));
        expect(same.headers.get('x-checksum-sha256')).toBe(hex);
    });

    test('omits checksum headers when checksum=false', async () => {
        const response = await runApi(() =>
            getAuthor(ctx('/api/v1/resume?o=pdf&c=false'), ['resume'])
        );
        expect(response.headers.get('content-type')).toBe('application/pdf');
        expect(response.headers.has('x-checksum-sha256')).toBe(false);
        expect(response.headers.has('repr-digest')).toBe(false);
    });

    test('rejects checksum without PDF output and PDF for other fields', async () => {
        const noPdf = await runApi(() =>
            getAuthor(ctx('/api/v1/resume?checksum=true'), ['resume'])
        );
        expect(noPdf.status).toBe(400);
        expect((await noPdf.json()).code).toBe('RESUME_CHECKSUM_REQUIRES_PDF');

        const wrongField = await runApi(() => getAuthor(ctx('/api/v1/author?f=profile&o=pdf')));
        expect((await wrongField.json()).code).toBe('OUTPUT_UNSUPPORTED');

        const unknown = await runApi(() => getAuthor(ctx('/api/v1/author?f=hobbies')));
        expect((await unknown.json()).code).toBe('AUTHOR_FIELD_INVALID');

        const fieldOnResume = await runApi(() =>
            getAuthor(ctx('/api/v1/resume?f=resume'), ['resume'])
        );
        expect((await fieldOnResume.json()).code).toBe('UNKNOWN_PARAMETER');
    });

    test('serves every verification file as a named attachment', async () => {
        const cases = [
            [
                'sha512',
                'resume.pdf.sha512',
                'text/plain; charset=utf-8',
                `${'b'.repeat(128)}  resume.pdf\n`
            ],
            [
                'b2',
                'resume.pdf.b2',
                'text/plain; charset=utf-8',
                `${'d'.repeat(128)}  resume.pdf\n`
            ],
            [
                'asc',
                'resume.pdf.asc',
                'application/pgp-signature',
                '-----BEGIN PGP SIGNATURE-----\n'
            ],
            ['sig', 'resume.pdf.sig', 'application/octet-stream', null],
            ['zip', 'resume-verify.zip', 'application/zip', null]
        ] as const;
        for (const [output, name, type, body] of cases) {
            const response = await runApi(() =>
                getAuthor(ctx(`/api/v1/resume?o=${output}`), ['resume'])
            );
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toBe(type);
            expect(response.headers.get('content-disposition')).toBe(
                `attachment; filename="${name}"`
            );
            if (body !== null) expect(await response.text()).toBe(body);
        }
        const zip = await runApi(() => getAuthor(ctx('/api/v1/resume?o=zip'), ['resume']));
        expect(zip.headers.get('repr-digest')).toContain('sha-256=:');
        const sums = await runApi(() => getAuthor(ctx('/api/v1/resume?o=md5&c=true'), ['resume']));
        expect((await sums.json()).code).toBe('RESUME_CHECKSUM_REQUIRES_PDF');
    });

    test('honors Want-Repr-Digest', async () => {
        const url = new URL('https://example.com/api/v1/resume?o=pdf');
        const response = await runApi(() =>
            getAuthor(
                {
                    ...ctx('/api/v1/resume?o=pdf'),
                    request: new Request(url, {
                        headers: { 'Want-Repr-Digest': 'sha-512=9, md5=10' }
                    })
                },
                ['resume']
            )
        );
        expect(response.headers.get('repr-digest')).toMatch(/^sha-512=:[^,]+:$/);
        expect(response.headers.has('x-checksum-sha256')).toBe(false);
    });

    test('assembles the bundle when none is stored yet', async () => {
        const stored = STORED['https://storage.test/resume/resume-verify.zip'];
        delete STORED['https://storage.test/resume/resume-verify.zip'];
        try {
            const response = await runApi(() => getAuthor(ctx('/api/v1/resume?o=zip'), ['resume']));
            expect(response.status).toBe(200);
            const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
            expect(Object.keys(files)).toContain('resume.pdf.sig');
            expect(files['resume.pdf']).toEqual(PDF);
            expect(strFromU8(files['resume.pdf.sha512'])).toBe(`${'b'.repeat(128)}  resume.pdf\n`);
            expect(strFromU8(files['VERIFY.txt'])).toContain('7ABA 82BF 0C80 A58C');
        } finally {
            STORED['https://storage.test/resume/resume-verify.zip'] = stored;
        }
    });

    test('keeps 502 for a PDF missing from storage and 404 for a bundle that cannot be built', async () => {
        const pdf = STORED['https://storage.test/resume/resume.pdf'];
        const zip = STORED['https://storage.test/resume/resume-verify.zip'];
        const checksums = resumeDocument.checksums;
        delete STORED['https://storage.test/resume/resume.pdf'];
        delete STORED['https://storage.test/resume/resume-verify.zip'];
        resumeDocument.checksums = null;
        try {
            const missingPdf = await runApi(() =>
                getAuthor(ctx('/api/v1/resume?o=pdf'), ['resume'])
            );
            expect(missingPdf.status).toBe(502);
            expect((await missingPdf.json()).code).toBe('RESUME_FETCH_FAILED');
            const missingZip = await runApi(() =>
                getAuthor(ctx('/api/v1/resume?o=zip'), ['resume'])
            );
            expect(missingZip.status).toBe(404);
            expect((await missingZip.json()).code).toBe('RESUME_BUNDLE_NOT_FOUND');
        } finally {
            STORED['https://storage.test/resume/resume.pdf'] = pdf;
            STORED['https://storage.test/resume/resume-verify.zip'] = zip;
            resumeDocument.checksums = checksums;
        }
    });

    test('reports a missing signature', async () => {
        const signedAt = resumeDocument.signedAt;
        resumeDocument.signedAt = null;
        try {
            const response = await runApi(() => getAuthor(ctx('/api/v1/resume?o=sig'), ['resume']));
            expect(response.status).toBe(404);
            expect((await response.json()).code).toBe('RESUME_SIGNATURE_NOT_FOUND');
        } finally {
            resumeDocument.signedAt = signedAt;
        }
    });

    test('describes the document, signer and key sources in JSON and markdown', async () => {
        const json = await (
            await runApi(() => getAuthor(ctx('/api/v1/resume'), ['resume']))
        ).json();
        expect(json.resume.document.checksums.sha256).toBe('a'.repeat(64));
        expect(json.resume.document.signature.fingerprint).toBe(FPR);
        expect(json.resume.document.signature.signer).toEqual([
            { name: 'Ada', email: 'ada@example.com' }
        ]);
        expect(json.resume.document.files.sig).toBe('https://example.com/v1/resume?output=sig');
        expect(json.resume.document.publicKey.keyservers).toHaveLength(1);
        const md = await (
            await runApi(() => getAuthor(ctx('/api/v1/resume?o=md'), ['resume']))
        ).text();
        expect(md).toContain('## Resume Document');
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
                is_anonymous: false,
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
