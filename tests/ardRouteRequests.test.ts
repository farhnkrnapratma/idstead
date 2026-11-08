// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, mock, test } from 'bun:test';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));

const explore = (await import('../apps/web/src/routes/api/ard/explore/+server.ts')) as {
    POST: (event: unknown) => Promise<Response>;
};
const agents = (await import('../apps/web/src/routes/api/ard/agents/+server.ts')) as {
    GET: (event: unknown) => Promise<Response>;
};

function exploreEvent(body: string, contentType = 'application/json') {
    return {
        request: new Request('https://example.com/api/ard/explore', {
            method: 'POST',
            headers: { 'content-type': contentType },
            body
        }),
        platform: {},
        fetch: globalThis.fetch
    };
}

function agentsEvent(query: string) {
    const url = new URL(`https://example.com/api/ard/agents${query}`);
    return { request: new Request(url), url, platform: {}, fetch: globalThis.fetch };
}

describe('ARD explore route request errors', () => {
    test('requires a JSON content type', async () => {
        const response = await explore.POST(exploreEvent('{}', 'text/plain'));
        expect(response.status).toBe(400);
    });

    test('rejects bodies that are not JSON objects', async () => {
        const response = await explore.POST(exploreEvent('[]'));
        expect(response.status).toBe(400);
    });

    test('rejects unsupported body fields', async () => {
        const response = await explore.POST(exploreEvent(JSON.stringify({ unknown: true })));
        expect(response.status).toBe(400);
    });
});

describe('ARD agents route request errors', () => {
    test('rejects page sizes outside the allowed range', async () => {
        for (const query of ['?pageSize=0', '?pageSize=101', '?pageSize=abc']) {
            const response = await agents.GET(agentsEvent(query));
            expect(response.status).toBe(400);
        }
    });

    test('rejects an unknown sort field', async () => {
        const response = await agents.GET(agentsEvent('?orderBy=secret'));
        expect(response.status).toBe(400);
    });
});
