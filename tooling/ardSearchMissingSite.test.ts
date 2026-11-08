// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, mock, test } from 'bun:test';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));
mock.module('../packages/lib/src/server/repositories.ts', () => ({
    publicRepositories: () => ({
        author: {
            profile: async () => {
                throw new Error('database unavailable');
            }
        }
    })
}));

const { POST } = (await import('../apps/web/src/routes/api/ard/search/+server.ts')) as {
    POST: (event: unknown) => Promise<Response>;
};

describe('ARD search route without site metadata', () => {
    test('reports missing site metadata as a service error', async () => {
        const event = {
            request: new Request('https://example.com/api/ard/search', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ query: { text: 'docs' } })
            }),
            platform: {},
            fetch: (async () => {
                throw new Error('index down');
            }) as unknown as typeof fetch
        };
        await expect(POST(event)).rejects.toMatchObject({ status: 503 });
    });
});
