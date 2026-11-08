// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { getAuthor } from '../packages/lib/src/server/api/author.ts';
import { ApiRequestError } from '../packages/lib/src/server/api/params.ts';

const DIGEST = 'a'.repeat(64);
const KEY = { fingerprint: 'ABCD1234', userIds: [], keyservers: [] };

function ctx(
    search: string,
    doc: Record<string, unknown> | null,
    options: { key?: unknown; keyError?: boolean; fetchStatus?: number; fetchError?: boolean } = {}
) {
    const fetched: string[] = [];
    return {
        ctx: {
            url: new URL(`https://api.example.com/v1/resume?${search}`),
            request: new Request(`https://api.example.com/v1/resume?${search}`),
            repos: {
                author: {
                    activeResumeDocument: async () => doc,
                    activeOpenPgpKey: async () => {
                        if (options.keyError) throw new Error('db');
                        return options.key === undefined ? KEY : options.key;
                    },
                    profile: async () => null,
                    resumeEntries: async () => ({ experience: [], education: [] }),
                    siteUrl: async () => 'https://example.com'
                }
            },
            fetch: (async (input: string) => {
                fetched.push(String(input));
                if (options.fetchError) throw new Error('offline');
                return new Response(new TextEncoder().encode('bytes'), {
                    status: options.fetchStatus ?? 200
                });
            }) as unknown as typeof fetch
        } as never,
        fetched
    };
}

const signed = {
    fileUrl: 'https://cdn.example.com/resume/ada.pdf',
    filename: 'ada.pdf',
    version: 'v1',
    updatedAt: '2026-01-02T00:00:00.000Z',
    signedAt: '2026-01-03T00:00:00.000Z',
    signerFingerprint: 'ABCD1234',
    checksums: { sha256: DIGEST }
};

describe('resume output through the author API', () => {
    test('serves a detached signature when the document is signed by the active key', async () => {
        const { ctx: c, fetched } = ctx('o=sig', signed);
        const response = await getAuthor(c, ['resume']);
        expect(response.headers.get('content-type')).toContain('application/octet-stream');
        expect(response.headers.get('content-disposition')).toContain('ada.pdf.sig');
        expect(fetched.at(-1)).toBe('https://cdn.example.com/resume/ada.pdf.sig');
    });

    test('refuses a signature for an unsigned document or a different key', async () => {
        const unsigned = ctx('o=asc', { ...signed, signedAt: null });
        await expect(getAuthor(unsigned.ctx, ['resume'])).rejects.toMatchObject({
            status: 404,
            code: 'RESUME_SIGNATURE_NOT_FOUND'
        });
        const otherKey = ctx('o=asc', signed, { key: { ...KEY, fingerprint: 'FFFF' } });
        await expect(getAuthor(otherKey.ctx, ['resume'])).rejects.toBeInstanceOf(ApiRequestError);
    });

    test('reports a failed key lookup as a metadata error for signatures', async () => {
        const { ctx: c } = ctx('o=asc', signed, { keyError: true });
        await expect(getAuthor(c, ['resume'])).rejects.toMatchObject({
            status: 500,
            code: 'RESUME_METADATA_FETCH_FAILED'
        });
    });

    test('answers checksum requests from stored digests or the stored file', async () => {
        const fromRecord = ctx('o=sha256', signed);
        const response = await getAuthor(fromRecord.ctx, ['resume']);
        expect(await response.text()).toBe(`${DIGEST}  ada.pdf\n`);

        const fromFile = ctx('o=md5', signed);
        const stored = await getAuthor(fromFile.ctx, ['resume']);
        expect(stored.headers.get('content-type')).toContain('text/plain');
        expect(fromFile.fetched.at(-1)).toBe('https://cdn.example.com/resume/ada.pdf.md5');
    });

    test('reports a missing or unreadable document as not found or a bad gateway', async () => {
        await expect(getAuthor(ctx('o=pdf', null).ctx, ['resume'])).rejects.toMatchObject({
            status: 404,
            code: 'RESUME_DOCUMENT_NOT_FOUND'
        });
        await expect(
            getAuthor(ctx('o=pdf', signed, { fetchStatus: 500 }).ctx, ['resume'])
        ).rejects.toMatchObject({ status: 502, code: 'RESUME_FETCH_FAILED' });
        await expect(
            getAuthor(ctx('o=pdf', signed, { fetchError: true }).ctx, ['resume'])
        ).rejects.toMatchObject({ status: 502, code: 'RESUME_FETCH_FAILED' });
    });
});
