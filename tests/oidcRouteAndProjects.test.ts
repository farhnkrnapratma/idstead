// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { oauthPreflight, oauthRoute } from '../packages/lib/src/server/oidc/route.ts';
import { fetchProjects } from '../packages/lib/src/server/githubProjects.ts';

describe('OAuth routes', () => {
    test('answers preflight requests with the CORS headers', () => {
        const response = oauthPreflight();
        expect(response.status).toBe(204);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    test('reports sign-in as unavailable when no signing key is configured', async () => {
        const response = await oauthRoute(
            {
                request: new Request('https://example.com/oauth/token', { method: 'POST' }),
                platform: { env: {} },
                getClientAddress: () => '203.0.113.9'
            },
            async () => new Response('never')
        );
        expect(response.status).toBe(404);
        expect(await response.json()).toMatchObject({ error: 'temporarily_unavailable' });
    });
});

describe('GitHub project listing', () => {
    test('lists nothing without a GitHub token', async () => {
        expect(
            await fetchProjects((async () => new Response('[]')) as unknown as typeof fetch, {})
        ).toEqual([]);
    });

    test('falls back to the cached list when GitHub refuses the request', async () => {
        const warn = console.warn;
        console.warn = () => {};
        try {
            const refused = (async () =>
                new Response('nope', {
                    status: 403,
                    statusText: 'Forbidden'
                })) as unknown as typeof fetch;
            expect(await fetchProjects(refused, { env: { GITHUB_PAT: 'token' } })).toEqual([]);
            const broken = (async () => {
                throw new Error('network down');
            }) as unknown as typeof fetch;
            expect(await fetchProjects(broken, { env: { GITHUB_PAT: 'token' } })).toEqual([]);
        } finally {
            console.warn = warn;
        }
    });
});
