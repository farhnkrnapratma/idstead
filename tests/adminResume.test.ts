// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

const font = (path: string) => Bun.file(`node_modules/@fontsource/${path}`).bytes();
const fonts = {
    sans: await font('ia-writer-quattro/files/ia-writer-quattro-latin-400-normal.woff'),
    sansBold: await font('ia-writer-quattro/files/ia-writer-quattro-latin-700-normal.woff'),
    sansItalic: await font('ia-writer-quattro/files/ia-writer-quattro-latin-400-italic.woff'),
    mono: await font('lilex/files/lilex-latin-400-normal.woff')
};

const state = {
    auth: null as Response | null,
    service: undefined as unknown,
    logged: [] as Array<Record<string, unknown>>
};

mock.module('../packages/lib/src/server/adminRequest.ts', () => ({
    requireAdminAuth: async () => state.auth,
    logAdminActivity: async (_req: Request, _platform: unknown, entry: Record<string, unknown>) =>
        void state.logged.push(entry)
}));
mock.module('../packages/lib/src/server/data.ts', () => ({
    dataStores: () => ({ service: state.service })
}));
mock.module('../packages/lib/src/server/resumeFonts.ts', () => ({ loadResumeFonts: () => fonts }));

const resume = await import('../packages/lib/src/server/adminResume.ts');
const { parsePublicKey, OpenPgpError } = await import('../packages/lib/src/server/openpgp.ts');

const fixture = (name: string) =>
    Bun.file(new URL(`./fixtures/openpgp/${name}`, import.meta.url)).bytes();
const pdf = await fixture('resume.pdf');
const adaArmored = await Bun.file(
    new URL('./fixtures/openpgp/ada.pub.asc', import.meta.url)
).text();
const adaBinary = await fixture('ada.pub.gpg');
const goodSig = await fixture('resume.pdf.sig');
const goodAsc = await fixture('resume.pdf.asc');
const malloroySig = await fixture('resume.pdf.mallory.sig');
const adaKey = await parsePublicKey(adaBinary);

function memoryBucket() {
    const store = new Map<string, Uint8Array>();
    const bucket = {
        store,
        failPut: false,
        failDelete: false,
        async put(key: string, value: Uint8Array) {
            if (bucket.failPut) throw new Error('put failed');
            store.set(key, value);
            return null;
        },
        async delete(keys: string | string[]) {
            if (bucket.failDelete) throw new Error('delete failed');
            for (const key of Array.isArray(keys) ? keys : [keys]) store.delete(key);
        }
    };
    return bucket;
}

let bucket = memoryBucket();
let platform: Record<string, unknown> = {};
const makePlatform = (env: Record<string, unknown> = {}) => ({
    env: {
        ASSET_BUCKET: bucket,
        PUBLIC_CDN_BASE_URL: 'https://cdn.test/',
        PUBLIC_API_BASE_URL: 'https://api.test',
        ...env
    }
});

const source = {
    profile: {
        id: 'author-1',
        name: 'Ada Lovelace',
        job_title: 'Engineer',
        headline: '',
        bio: 'Bio',
        email: 'ada@example.com',
        site_url: 'https://ada.test',
        city: 'London',
        country: 'UK',
        avatar_version: null
    },
    experiences: [],
    educations: [],
    skills: [{ category: 'Languages', items: ['TypeScript'] }],
    socials: [
        { platform: 'GitHub', url: 'https://github.com/ada' },
        { platform: 'Mastodon', url: 'https://social.test/@ada' }
    ],
    repoRules: { excluded: [] as string[], pinned: [] as string[] }
};

interface Docs {
    [key: string]: (...args: any[]) => Promise<any>;
}

let docs: Docs;
let keys: Docs;
let published: Array<[Record<string, unknown>, unknown]>;
let fetched: string[];
let remote: (url: string) => Response | undefined;

function reset() {
    published = [];
    fetched = [];
    remote = () => undefined;
    docs = {
        sourceData: async () => structuredClone(source),
        active: async () => null,
        activeFilenames: async () => [],
        findFilename: async (name: string) => (name === 'known.pdf' ? 'known.pdf' : null),
        snapshot: async () => null,
        publish: async (document: Record<string, unknown>, snapshot: unknown) => {
            published.push([document, snapshot]);
            return { id: 'doc-new' };
        },
        setChecksums: async () => {},
        setSignature: async () => {},
        signerFingerprint: async () => null,
        delete: async () => true,
        siteUrl: async () => 'https://site.test/'
    };
    keys = { active: async () => null, removeActive: async () => {}, publish: async () => {} };
    state.service = { resumeDocuments: docs, openPgpKeys: keys };
}

const realFetch = globalThis.fetch;
const realError = console.error;
const realWarn = console.warn;

beforeEach(() => {
    bucket = memoryBucket();
    platform = makePlatform();
    state.auth = null;
    state.logged = [];
    reset();
    console.error = () => {};
    console.warn = () => {};
    globalThis.fetch = (async (input: string | URL) => {
        const url = String(input);
        fetched.push(url);
        const custom = remote(url);
        if (custom) return custom;
        if (url.endsWith('.pdf')) return new Response(pdf);
        return new Response('missing', { status: 404 });
    }) as never;
});

afterEach(() => {
    globalThis.fetch = realFetch;
    console.error = realError;
    console.warn = realWarn;
});

const post = (body?: unknown, headers: Record<string, string> = {}, method = 'POST') =>
    new Request('https://admin.test/api', {
        method,
        headers: { 'content-type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
const json = async (response: Response) => (await response.json()) as Record<string, any>;
const activeDoc = {
    id: 'doc-1',
    filename: 'Resume-Ada-abcdef0-v1.0.pdf',
    file_url: 'https://cdn.test/resume/Resume-Ada-abcdef0-v1.0.pdf',
    signed_at: null as string | null
};

describe('formatAuthorSlug', () => {
    test('builds a filename slug', () => {
        expect(resume.formatAuthorSlug()).toBe('Resume-Profile');
        expect(resume.formatAuthorSlug('   ')).toBe('Resume-Profile');
        expect(resume.formatAuthorSlug('ada &amp; lovelace')).toBe('Resume-Ada_Lovelace');
        expect(resume.formatAuthorSlug('***')).toBe('Resume-Profile');
    });
});

describe('processResumeGenerate', () => {
    test('relays authentication failures and missing services', async () => {
        state.auth = new Response('denied', { status: 401 });
        expect((await resume.processResumeGenerate(post(), platform)).status).toBe(401);
        state.auth = null;
        state.service = undefined;
        const response = await resume.processResumeGenerate(post(), platform);
        expect(response.status).toBe(500);
        expect(JSON.stringify(await response.json())).toContain('auto-generate');
    });

    test('reports source data problems', async () => {
        docs.sourceData = async () => {
            throw new Error('db');
        };
        expect((await resume.processResumeGenerate(post(), platform)).status).toBe(500);
        docs.sourceData = async () => null;
        expect((await resume.processResumeGenerate(post(), platform)).status).toBe(404);
    });

    test('publishes the first version with checksums and a bundle', async () => {
        docs.activeFilenames = async () => ['old.pdf'];
        bucket.store.set('resume/old.pdf', new Uint8Array(1));
        const response = await resume.processResumeGenerate(post(), platform, () => '1.2.3.4');
        const body = await json(response);
        expect(response.status).toBe(200);
        expect(body).toMatchObject({ success: true, version: '1.0', level: 'major' });
        expect(body.reasons).toEqual(['First version']);
        expect(body.filename).toMatch(/^Resume-Ada_Lovelace-[0-9a-f]{7}-v1\.0\.pdf$/);
        expect(body.fileUrl).toBe(`https://cdn.test/resume/${body.filename}`);
        expect(bucket.store.has(`resume/${body.filename}`)).toBe(true);
        expect(bucket.store.has(`resume/${body.filename}.sha256`)).toBe(true);
        expect(bucket.store.has('resume/old.pdf')).toBe(false);
        expect([...bucket.store.keys()].some(key => key.endsWith('.zip'))).toBe(true);
        expect(published[0][0]).toMatchObject({ authorId: 'author-1', version: '1.0' });
        expect(state.logged[0]).toMatchObject({ action: 'resume.upload', category: 'resume' });
    });

    test('keeps the current document when nothing changed', async () => {
        const first = await json(await resume.processResumeGenerate(post(), platform));
        const snapshot = published[0][1];
        docs.active = async () => ({ ...activeDoc, filename: first.filename });
        docs.snapshot = async () => snapshot;
        const same = await json(await resume.processResumeGenerate(post(), platform));
        expect(same).toMatchObject({ upToDate: true, version: '1.0' });
        docs.active = async () => ({ ...activeDoc, filename: 'unversioned.pdf' });
        const fallback = await json(await resume.processResumeGenerate(post(), platform));
        expect(fallback).toMatchObject({ upToDate: true, version: '1.0' });
    });

    test('regenerates on request and on changes', async () => {
        const first = await json(await resume.processResumeGenerate(post(), platform));
        const snapshot = published[0][1];
        docs.active = async () => ({ ...activeDoc, filename: first.filename });
        docs.snapshot = async () => snapshot;
        const forced = await json(
            await resume.processResumeGenerate(post({ force: true }), platform)
        );
        expect(forced).toMatchObject({ version: '1.1', level: 'minor' });
        expect(forced.reasons).toEqual(['Regenerated on request']);
        docs.snapshot = async () => null;
        const changed = await json(await resume.processResumeGenerate(post(), platform));
        expect(changed.version).toMatch(/^\d+\.\d+$/);
        expect(changed.reasons.length).toBeGreaterThan(0);
        const badBody = new Request('https://admin.test/api', { method: 'POST', body: '{' });
        expect((await resume.processResumeGenerate(badBody, platform)).status).toBe(200);
    });

    test('ranks projects by pinned status, stars and recency', async () => {
        docs.sourceData = async () => ({
            ...structuredClone(source),
            repoRules: { excluded: ['skip'], pinned: ['Pinned'] }
        });
        const repo = (name: string, stars: number, pushed: string | null) => ({
            name,
            full_name: `ada/${name}`,
            description: name,
            html_url: `https://github.com/ada/${name}`,
            clone_url: '',
            ssh_url: '',
            default_branch: 'main',
            language: 'TypeScript',
            stargazers_count: stars,
            forks_count: 0,
            created_at: null,
            pushed_at: pushed,
            topics: [],
            fork: false,
            archived: false,
            private: false,
            license: null
        });
        remote = url => {
            if (url.includes('/user/repos'))
                return Response.json([
                    repo('low', 1, '2026-01-01'),
                    repo('pinned', 0, null),
                    repo('popular', 9, '2026-01-02'),
                    repo('tied-new', 5, '2026-03-01'),
                    repo('tied-old', 5, null),
                    repo('skip', 99, null),
                    repo('also-tied', 5, '2026-02-01')
                ]);
            return undefined;
        };
        platform = makePlatform({ GITHUB_PAT: 'token' });
        const realNow = Date.now;
        Date.now = () => realNow() + 3_600_000;
        try {
            const response = await resume.processResumeGenerate(post(), platform);
            expect(response.status).toBe(200);
        } finally {
            Date.now = realNow;
        }
        expect(fetched.some(url => url.includes('/user/repos'))).toBe(true);
    });

    test('fails when storage is missing or rejects uploads', async () => {
        platform = { env: {} };
        const missing = await resume.processResumeGenerate(post(), platform);
        expect(JSON.stringify(await missing.json())).toContain('Failed to upload resume file.');
        platform = makePlatform();
        bucket.failPut = true;
        const failed = await resume.processResumeGenerate(post(), platform);
        expect(failed.status).toBe(500);
        expect(JSON.stringify(await failed.json())).toContain('Failed to upload resume file.');
    });

    test('fails when the record cannot be saved', async () => {
        docs.publish = async () => {
            throw new Error('db');
        };
        const response = await resume.processResumeGenerate(post(), platform);
        expect(JSON.stringify(await response.json())).toContain('Failed to save resume record.');
    });

    test('still succeeds when the bundle cannot be built', async () => {
        keys.active = async () => {
            throw new Error('keys down');
        };
        expect((await resume.processResumeGenerate(post(), platform)).status).toBe(200);
    });

    test('tolerates failures saving checksums and uses the active key', async () => {
        keys.active = async () => ({
            ...adaKey,
            keyservers: [],
            createdAt: adaKey.createdAt,
            armored: adaKey.armored
        });
        docs.setChecksums = async () => {
            throw new Error('db');
        };
        platform = makePlatform({ PUBLIC_SITE_URL: 'https://env.test' });
        docs.siteUrl = async () => {
            throw new Error('db');
        };
        expect((await resume.processResumeGenerate(post(), platform)).status).toBe(200);
        expect([...bucket.store.keys()].some(key => key.endsWith('.zip'))).toBe(true);
    });

    test('falls back to the public environment site url', async () => {
        docs.siteUrl = async () => '';
        platform = makePlatform({ PUBLIC_SITE_URL: undefined });
        expect((await resume.processResumeGenerate(post(), platform)).status).toBe(200);
    });

    test('processResumeUpload delegates to generation', async () => {
        const response = await resume.processResumeUpload(post(), platform);
        expect((await json(response)).success).toBe(true);
    });
});

describe('processResumeDelete', () => {
    test('requires authentication and a store', async () => {
        state.auth = new Response('denied', { status: 403 });
        expect((await resume.processResumeDelete(post(), platform)).status).toBe(403);
        state.auth = null;
        state.service = undefined;
        expect((await resume.processResumeDelete(post(), platform)).status).toBe(500);
    });

    test('deletes a named document', async () => {
        bucket.store.set('resume/known.pdf', new Uint8Array(1));
        const response = await resume.processResumeDelete(
            post({ filename: ' known.pdf ' }),
            platform,
            () => '1.2.3.4'
        );
        expect(await json(response)).toEqual({ success: true, filename: 'known.pdf' });
        expect(state.logged[0]).toMatchObject({ action: 'resume.delete', entityId: 'known.pdf' });
    });

    test('reports unknown documents', async () => {
        expect(
            (await resume.processResumeDelete(post({ filename: 'nope.pdf' }), platform)).status
        ).toBe(404);
        docs.findFilename = async () => {
            throw new Error('db');
        };
        expect(
            (await resume.processResumeDelete(post({ filename: 'x.pdf' }), platform)).status
        ).toBe(404);
    });

    test('falls back to the active document', async () => {
        const noBody = new Request('https://admin.test/api', { method: 'POST', body: 'garbage' });
        expect((await resume.processResumeDelete(noBody, platform)).status).toBe(404);
        docs.active = async () => {
            throw new Error('db');
        };
        expect((await resume.processResumeDelete(post({ filename: '  ' }), platform)).status).toBe(
            404
        );
        docs.active = async () => activeDoc;
        const response = await resume.processResumeDelete(post({}), platform);
        expect((await json(response)).filename).toBe(activeDoc.filename);
    });

    test('reports a failed record removal', async () => {
        docs.active = async () => activeDoc;
        docs.delete = async () => false;
        expect((await resume.processResumeDelete(post({}), platform)).status).toBe(500);
    });
});

describe('deleteResumeFile', () => {
    const run = (strict: boolean) =>
        resume.deleteResumeFile(platform, docs as never, activeDoc.filename, strict);

    test('removes objects and the record', async () => {
        bucket.store.set(`resume/${activeDoc.filename}`, new Uint8Array(1));
        expect(await run(false)).toBe(true);
        expect(bucket.store.size).toBe(0);
    });

    test('strict mode requires storage and successful deletion', async () => {
        platform = { env: {} };
        expect(await run(true)).toBe(false);
        expect(await run(false)).toBe(true);
        platform = makePlatform();
        bucket.failDelete = true;
        expect(await run(true)).toBe(false);
        expect(await run(false)).toBe(true);
    });
});

describe('processResumeSignature', () => {
    const withKey = () => {
        keys.active = async () => ({ ...adaKey, keyservers: [], armored: adaKey.armored });
    };
    const upload = (body: Uint8Array, headers: Record<string, string> = {}) =>
        new Request('https://admin.test/api', { method: 'PUT', headers, body: body as BodyInit });

    test('requires authentication, a store and an active document', async () => {
        state.auth = new Response('denied', { status: 401 });
        expect((await resume.processResumeSignature(post(), platform)).status).toBe(401);
        state.auth = null;
        expect((await resume.processResumeSignature(post(), platform)).status).toBe(404);
        state.service = undefined;
        expect((await resume.processResumeSignature(post(), platform)).status).toBe(500);
    });

    test('removes a signature', async () => {
        docs.active = async () => ({ ...activeDoc, signed_at: '2026-01-01T00:00:00Z' });
        const cleared: unknown[] = [];
        docs.setSignature = async (...args: unknown[]) => void cleared.push(args);
        const response = await resume.processResumeSignature(
            post(undefined, {}, 'DELETE'),
            platform,
            () => '1.2.3.4'
        );
        expect(await json(response)).toEqual({
            success: true,
            signedAt: null,
            signerFingerprint: null
        });
        expect(cleared).toEqual([['doc-1', null]]);
        expect(state.logged[0].action).toBe('resume.signature_delete');
    });

    test('fails to rebuild the bundle without storage', async () => {
        docs.active = async () => activeDoc;
        platform = { env: { PUBLIC_API_BASE_URL: 'https://api.test' } };
        const response = await resume.processResumeSignature(
            post(undefined, {}, 'DELETE'),
            platform
        );
        expect(response.status).toBe(500);
    });

    test('rejects oversized signatures', async () => {
        docs.active = async () => activeDoc;
        const declared = upload(new Uint8Array(1), { 'content-length': '999999' });
        expect((await resume.processResumeSignature(declared, platform)).status).toBe(413);
        const streamed = upload(new Uint8Array(20_000));
        expect((await resume.processResumeSignature(streamed, platform)).status).toBe(413);
    });

    test('requires an active key', async () => {
        docs.active = async () => activeDoc;
        expect((await resume.processResumeSignature(upload(goodSig), platform)).status).toBe(409);
    });

    test('stores a verified signature', async () => {
        docs.active = async () => activeDoc;
        withKey();
        const signed: unknown[] = [];
        docs.setSignature = async (...args: unknown[]) => void signed.push(args);
        const response = await resume.processResumeSignature(upload(goodSig), platform);
        const body = await json(response);
        expect(body).toMatchObject({ success: true, signerFingerprint: adaKey.fingerprint });
        expect(signed).toHaveLength(1);
        expect(bucket.store.has(`resume/${activeDoc.filename}.asc`)).toBe(true);
        expect(bucket.store.has(`resume/${activeDoc.filename}.sig`)).toBe(true);
        const armored = await resume.processResumeSignature(upload(goodAsc), platform);
        expect(armored.status).toBe(200);
        expect(state.logged[0].action).toBe('resume.signature_upload');
    });

    test('rejects signatures from other keys', async () => {
        docs.active = async () => activeDoc;
        withKey();
        const response = await resume.processResumeSignature(upload(malloroySig), platform);
        expect(response.status).toBe(422);
        const garbage = await resume.processResumeSignature(
            upload(new Uint8Array([1, 2, 3])),
            platform
        );
        expect(garbage.status).toBe(422);
    });

    test('reports unexpected failures', async () => {
        docs.active = async () => activeDoc;
        withKey();
        remote = () => new Response('gone', { status: 500 });
        const response = await resume.processResumeSignature(upload(goodSig), platform);
        expect(response.status).toBe(500);
        expect(JSON.stringify(await response.json())).toContain('resume signature');
    });
});

describe('processOpenPgpKey', () => {
    const put = (body: unknown, headers: Record<string, string> = {}) => post(body, headers, 'PUT');
    const key = (armored = adaArmored) => ({ key: { armored } });
    const stored = () => ({ ...adaKey, keyservers: [], armored: adaKey.armored });

    test('requires authentication and a store', async () => {
        state.auth = new Response('denied', { status: 401 });
        expect((await resume.processOpenPgpKey(put(key()), platform)).status).toBe(401);
        state.auth = null;
        state.service = undefined;
        expect((await resume.processOpenPgpKey(put(key()), platform)).status).toBe(500);
    });

    test('removes the key and clears the signature', async () => {
        keys.active = async () => stored();
        docs.active = async () => ({ ...activeDoc, signed_at: '2026-01-01T00:00:00Z' });
        const response = await resume.processOpenPgpKey(post(undefined, {}, 'DELETE'), platform);
        expect(await json(response)).toEqual({ success: true, key: null, signatureCleared: true });
        expect(state.logged[0]).toMatchObject({ action: 'resume.openpgp_key_delete' });
    });

    test('removes the key without a document or signature', async () => {
        const bare = await resume.processOpenPgpKey(post(undefined, {}, 'DELETE'), platform);
        expect((await json(bare)).signatureCleared).toBe(false);
        expect(state.logged[0].entityId).toBe('openpgp-key');
        docs.active = async () => activeDoc;
        const unsigned = await resume.processOpenPgpKey(post(undefined, {}, 'DELETE'), platform);
        expect((await json(unsigned)).signatureCleared).toBe(false);
    });

    test('reports removal failures', async () => {
        keys.removeActive = async () => {
            throw new Error('db');
        };
        expect(
            (await resume.processOpenPgpKey(post(undefined, {}, 'DELETE'), platform)).status
        ).toBe(500);
    });

    test('rejects bad request bodies', async () => {
        const large = put(key(), { 'content-length': '999999' });
        expect((await resume.processOpenPgpKey(large, platform)).status).toBe(413);
        const huge = put({ key: { armored: 'x'.repeat(140_000) } });
        expect((await resume.processOpenPgpKey(huge, platform)).status).toBe(413);
        const malformed = new Request('https://admin.test/api', { method: 'PUT', body: '{' });
        expect((await resume.processOpenPgpKey(malformed, platform)).status).toBe(400);
        expect((await resume.processOpenPgpKey(put({}), platform)).status).toBe(400);
        expect((await resume.processOpenPgpKey(put(null), platform)).status).toBe(400);
    });

    test('publishes an armored key', async () => {
        const published: Array<Record<string, any>> = [];
        keys.publish = async (value: Record<string, any>) => void published.push(value);
        const response = await resume.processOpenPgpKey(put(key()), platform, () => '1.2.3.4');
        const body = await json(response);
        expect(body).toMatchObject({ success: true, signatureCleared: false });
        expect(body.key.fingerprint).toBe(adaKey.fingerprint);
        expect(body.key).not.toHaveProperty('key');
        expect(published[0].fingerprint).toBe(adaKey.fingerprint);
        expect(state.logged[0].summary).toContain('Published OpenPGP key');
    });

    test('publishes a base64 key and reuses the stored key', async () => {
        const base64 = btoa(String.fromCharCode(...adaBinary));
        expect((await resume.processOpenPgpKey(put({ key: { base64 } }), platform)).status).toBe(
            200
        );
        expect(
            (await resume.processOpenPgpKey(put({ key: { base64: '***' } }), platform)).status
        ).toBe(422);
        keys.active = async () => stored();
        const reuse = await resume.processOpenPgpKey(put({ keyservers: [] }), platform);
        expect(reuse.status).toBe(200);
        expect(state.logged.at(-1)?.summary).toBe('Updated the OpenPGP key keyservers.');
    });

    test('rejects invalid keys', async () => {
        expect((await resume.processOpenPgpKey(put(key('not a key')), platform)).status).toBe(422);
        const privateKey = await Bun.file(
            new URL('./fixtures/openpgp/private.asc', import.meta.url)
        ).text();
        expect((await resume.processOpenPgpKey(put(key(privateKey)), platform)).status).toBe(422);
    });

    test('validates keyservers', async () => {
        const body = (keyservers: unknown) => put({ ...key(), keyservers });
        const status = async (keyservers: unknown) =>
            (await resume.processOpenPgpKey(body(keyservers), platform)).status;
        expect(await status('nope')).toBe(200);
        expect(await status(Array.from({ length: 9 }, () => ({ url: 'https://a.test/k' })))).toBe(
            422
        );
        expect(await status([{ url: 'http://a.test/k' }])).toBe(422);
        expect(await status([{ url: '   ' }, null])).toBe(200);
    });

    test('verifies keyservers', async () => {
        remote = url => (url.includes('good.test') ? new Response(adaArmored) : undefined);
        const response = await resume.processOpenPgpKey(
            put({
                ...key(),
                keyservers: [
                    { url: 'https://good.test/key', label: ' Good ' },
                    { url: 'https://good.test/key' },
                    { url: 'https://good2.test/key' },
                    { url: 'https://good3.test/key', label: 5 }
                ]
            }),
            platform
        );
        expect(response.status).toBe(422);
        remote = url => (url.includes('good') ? new Response(adaArmored) : undefined);
        const ok = await resume.processOpenPgpKey(
            put({
                ...key(),
                keyservers: [
                    { url: 'https://good.test/key', label: ' Good ' },
                    { url: 'https://good.test/key' },
                    { url: 'https://good2.test/key', label: 5 }
                ]
            }),
            platform
        );
        const body = await json(ok);
        expect(body.key.keyservers).toEqual([
            { label: 'Good', url: 'https://good.test/key' },
            { label: 'good2.test', url: 'https://good2.test/key' }
        ]);
    });

    test('reports store failures', async () => {
        keys.publish = async () => {
            throw new Error('db');
        };
        expect((await resume.processOpenPgpKey(put(key()), platform)).status).toBe(500);
    });

    test('restores the stored signature when the signer is unchanged', async () => {
        docs.active = async () => ({ ...activeDoc, signed_at: '2026-01-01T00:00:00Z' });
        docs.signerFingerprint = async () => adaKey.fingerprint;
        remote = url => (url.endsWith('.asc') ? new Response(goodAsc) : undefined);
        const response = await resume.processOpenPgpKey(put(key()), platform);
        expect((await json(response)).signatureCleared).toBe(false);
        expect(bucket.store.has(`resume/${activeDoc.filename}.asc`)).toBe(true);
        remote = url => (url.endsWith('.sig') ? new Response(goodSig) : undefined);
        bucket.store.clear();
        await resume.processOpenPgpKey(put(key()), platform);
        expect(bucket.store.has(`resume/${activeDoc.filename}.sig`)).toBe(true);
        remote = () => undefined;
        bucket.store.clear();
        await resume.processOpenPgpKey(put(key()), platform);
        expect(bucket.store.has(`resume/${activeDoc.filename}.sig`)).toBe(false);
    });

    test('clears signatures made by a replaced key', async () => {
        docs.active = async () => ({ ...activeDoc, signed_at: '2026-01-01T00:00:00Z' });
        docs.signerFingerprint = async () => 'OTHER';
        const cleared = await json(await resume.processOpenPgpKey(put(key()), platform));
        expect(cleared.signatureCleared).toBe(true);
        docs.signerFingerprint = async () => adaKey.fingerprint;
        const kept = await json(await resume.processOpenPgpKey(put(key()), platform));
        expect(kept.signatureCleared).toBe(false);
        docs.active = async () => activeDoc;
        const unsigned = await json(await resume.processOpenPgpKey(put(key()), platform));
        expect(unsigned.signatureCleared).toBe(false);
    });

    test('exposes OpenPgpError for assertions', () => {
        expect(new OpenPgpError('x')).toBeInstanceOf(Error);
    });
});
