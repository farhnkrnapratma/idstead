// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, mock, test } from 'bun:test';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));

const { POST } = (await import('../apps/web/src/routes/api/ard/search/+server.ts')) as {
    POST: (event: unknown) => Promise<Response>;
};

function event(body: string) {
    return {
        request: new Request('https://example.com/api/ard/search', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body
        }),
        platform: {},
        fetch: (async () => {
            throw new Error('index down');
        }) as unknown as typeof fetch
    };
}

describe('ARD search route', () => {
    test('rejects request bodies that are not JSON', async () => {
        const response = await POST(event('{not json'));
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
    });
});
