// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, expect, mock, test } from 'bun:test';

const state = { frozen: false, limited: false, deps: {} as Record<string, unknown> | null };

const realRate = await import('../packages/lib/src/server/rateLimit.ts');
const realFreeze = await import('../packages/lib/src/server/writeFreeze.ts');
const realDeps = await import('../packages/lib/src/server/oidc/deps.ts');

mock.module('../packages/lib/src/server/rateLimit.ts', () => ({
    ...realRate,
    checkRateLimit: async () => ({ limited: state.limited, headers: { 'X-Limit': '1' } }),
    clientIp: () => '203.0.113.9'
}));
mock.module('../packages/lib/src/server/writeFreeze.ts', () => ({
    ...realFreeze,
    writesFrozen: () => state.frozen
}));
mock.module('../packages/lib/src/server/oidc/deps.ts', () => ({
    ...realDeps,
    oidcEndpointDeps: async () => state.deps
}));

const { oauthPreflight, oauthRoute } = await import('../packages/lib/src/server/oidc/route.ts');

const event = {
    request: new Request('https://example.com/oauth/token'),
    platform: {},
    getClientAddress: () => '203.0.113.9'
};

beforeEach(() => {
    state.frozen = false;
    state.limited = false;
    state.deps = {};
});

test('answers preflight requests with no content', () => {
    expect(oauthPreflight().status).toBe(204);
});

test('pauses writes during maintenance with a retry hint', async () => {
    state.frozen = true;
    const response = await oauthRoute(event, async () => new Response('ok'), { writes: true });
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(await response.json()).toMatchObject({ error: 'temporarily_unavailable' });
});

test('slows down clients that exceed the rate limit', async () => {
    state.limited = true;
    const response = await oauthRoute(event, async () => new Response('ok'));
    expect(response.status).toBe(429);
    expect(response.headers.get('x-limit')).toBe('1');
    expect(await response.json()).toMatchObject({ error: 'slow_down' });
});

test('reports sign-in as not set up when no deps are configured', async () => {
    state.deps = null;
    const response = await oauthRoute(event, async () => new Response('ok'));
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'temporarily_unavailable' });
});

test('turns a failing handler into a server error', async () => {
    const response = await oauthRoute(event, async () => {
        throw new Error('db down');
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: 'server_error' });
});

test('returns the handler response when everything is in place', async () => {
    const response = await oauthRoute(event, async () => new Response('token', { status: 201 }));
    expect(response.status).toBe(201);
    expect(await response.text()).toBe('token');
});
