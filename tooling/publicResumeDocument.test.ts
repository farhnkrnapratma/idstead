// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, expect, mock, test } from 'bun:test';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));

const state = {
    document: null as Record<string, unknown> | null,
    documentError: false,
    key: null as Record<string, unknown> | null,
    keyError: false,
    siteUrl: 'https://example.com',
    siteError: false,
    fetches: [] as unknown[]
};

mock.module('../packages/lib/src/server/repositories.ts', () => ({
    publicRepositories: (fetchFn: unknown) => {
        state.fetches.push(fetchFn);
        return {
            author: {
                activeResumeDocument: async () => {
                    if (state.documentError) throw new Error('db');
                    return state.document;
                },
                activeOpenPgpKey: async () => {
                    if (state.keyError) throw new Error('db');
                    return state.key;
                },
                siteUrl: async () => {
                    if (state.siteError) throw new Error('db');
                    return state.siteUrl;
                }
            }
        };
    }
}));

const { loadPublicResumeDocument } =
    await import('../packages/lib/src/server/publicResumeDocument.ts');

const fetchFn = globalThis.fetch;
const document = {
    fileUrl: 'https://cdn.example.com/resume.pdf',
    version: 'v1',
    updatedAt: '2026-01-02T00:00:00.000Z'
};
const key = {
    fingerprint: 'ABCD1234',
    userIds: [{ name: 'Ada', email: 'ada@example.com' }],
    keyservers: ['https://keys.example.com']
};

beforeEach(() => {
    state.document = document;
    state.documentError = false;
    state.key = key;
    state.keyError = false;
    state.siteUrl = 'https://example.com';
    state.siteError = false;
    state.fetches = [];
});

test('returns nothing when no resume document is active', async () => {
    state.document = null;
    expect(await loadPublicResumeDocument(fetchFn)).toBeNull();
    state.document = { fileUrl: '' };
    expect(await loadPublicResumeDocument(fetchFn)).toBeNull();
});

test('returns nothing when the document lookup fails', async () => {
    state.documentError = true;
    expect(await loadPublicResumeDocument(fetchFn)).toBeNull();
});

test('describes the resume with its signing key when both are available', async () => {
    state.document = {
        ...document,
        signedAt: '2026-01-03T00:00:00.000Z',
        signerFingerprint: 'ABCD1234'
    };
    const info = await loadPublicResumeDocument(fetchFn);
    expect(info).not.toBeNull();
    expect(JSON.stringify(info)).toContain('ABCD1234');
    expect(state.fetches[0]).toBe(fetchFn);
});

test('describes the resume without a signing key when none is active', async () => {
    state.key = null;
    const info = await loadPublicResumeDocument(fetchFn);
    expect(info).not.toBeNull();
    expect(JSON.stringify(info)).not.toContain('ABCD1234');
});

test('falls back to an empty site URL and a missing key when those lookups fail', async () => {
    state.keyError = true;
    state.siteError = true;
    const info = await loadPublicResumeDocument(fetchFn);
    expect(info).not.toBeNull();
    expect(JSON.stringify(info)).not.toContain('ABCD1234');
});
