// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { getAuthor } from '../packages/lib/src/server/api/author.ts';
import { runApi } from '../packages/lib/src/server/api/responses.ts';

const failingRepository = new Proxy(
    {},
    {
        get: () => async () => {
            throw new Error('database down');
        }
    }
);

const missingStorage = (async () =>
    new Response('missing', { status: 404 })) as unknown as typeof fetch;

function ctx(path: string) {
    const url = new URL(`https://example.com${path}`);
    return {
        url,
        request: new Request(url),
        repos: { author: failingRepository } as never,
        fetch: missingStorage
    };
}

describe('author and resume endpoints when storage fails', () => {
    test('reports author information that cannot be fetched', async () => {
        const response = await runApi(() => getAuthor(ctx('/api/v1/author')));
        expect(response.status).toBe(500);
        expect(await response.json()).toMatchObject({ code: 'AUTHOR_FETCH_FAILED' });
    });

    test('reports resume metadata and files that cannot be fetched', async () => {
        const response = await runApi(() => getAuthor(ctx('/api/v1/resume?o=pdf'), ['resume']));
        expect(response.status).toBeGreaterThanOrEqual(404);
        const body = (await response.json()) as { code: string };
        expect(typeof body.code).toBe('string');
    });
});
