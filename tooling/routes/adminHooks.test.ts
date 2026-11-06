// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { more, slot } from './support.ts';

const state = {
    client: false,
    identity: { email: 'admin@example.com' } as unknown,
    identityCalls: 0,
    serveError: false,
    served: [] as string[],
    captured: [] as unknown[],
    resolveOptions: [] as unknown[],
    respond: (() => new Response('ok')) as () => Response
};

mock.module('@sveltejs/kit/hooks', () => ({
    sequence:
        (...handlers: Array<(input: any) => Promise<Response>>) =>
        ({ event, resolve }: any) => {
            const run = (index: number, current: any, options?: any): Promise<Response> =>
                index < handlers.length ?
                    handlers[index]({
                        event: current,
                        resolve: (next: any, nextOptions?: any) =>
                            run(index + 1, next, nextOptions ?? options)
                    })
                :   resolve(current, options);
            return run(0, event);
        }
}));
mock.module('@sentry/sveltekit', () => ({
    getClient: () => (state.client ? {} : undefined),
    initCloudflareSentryHandle: () => (input: any) => input.resolve(input.event),
    sentryHandle: () => (input: any) => input.resolve(input.event),
    captureException: (error: unknown) => void state.captured.push(error),
    handleErrorWithSentry: () => () => {}
}));
slot.accessIdentity = async () => {
    state.identityCalls++;
    return state.identity;
};
more.serveIdentityAsset = async (request: Request) => {
    if (state.serveError) throw new Error('storage');
    state.served.push(request.url);
    return new Response('image', { headers: { 'content-type': 'image/webp' } });
};

async function load(client: boolean) {
    state.client = client;
    const target = `../../apps/admin/src/hooks.server.ts?client=${client}`;
    return (await import(target)) as { handle: (input: any) => Promise<Response> };
}
const { handle } = await load(false);
const passthrough = await load(true);

async function call(
    path: string,
    init: { method?: string; headers?: Record<string, string> } = {}
) {
    const url = new URL(`https://admin.example.com${path}`);
    const event: any = {
        request: new Request(url, { method: init.method ?? 'GET', headers: init.headers }),
        url,
        platform: {},
        locals: {}
    };
    const response = await handle({
        event,
        resolve: async (_inner: any, options?: any) => {
            state.resolveOptions.push(options);
            return state.respond();
        }
    });
    return { response, event };
}

beforeEach(() => {
    state.identity = { email: 'admin@example.com' };
    state.identityCalls = 0;
    state.serveError = false;
    state.served = [];
    state.captured = [];
    state.resolveOptions = [];
    state.respond = () => new Response('ok');
});

describe('admin authentication', () => {
    test('blocks guarded pages without an Access identity', async () => {
        state.identity = null;
        const { response } = await call('/blog');
        expect(response.status).toBe(401);
        expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
        expect(await response.text()).toContain('Cloudflare Access');
        expect(state.resolveOptions).toEqual([]);
    });

    test('lets public paths, the API and assets through without a lookup', async () => {
        state.identity = null;
        for (const path of ['/robots.txt', '/api/internal/admin/x', '/_app/chunk.js'])
            expect((await call(path)).response.status).toBe(200);
        expect((await call('/avatar.webp')).response.status).toBe(200);
        expect(state.identityCalls).toBe(0);
    });

    test('resolves guarded pages for admins and caches the lookup', async () => {
        const { response, event } = await call('/');
        expect(response.status).toBe(200);
        await event.locals.getAdmin();
        expect(state.identityCalls).toBe(1);
        const options = state.resolveOptions[0] as {
            filterSerializedResponseHeaders: (name: string) => boolean;
        };
        expect(options.filterSerializedResponseHeaders('content-range')).toBe(true);
        expect(options.filterSerializedResponseHeaders('etag')).toBe(false);
    });
});

describe('admin responses', () => {
    test('serves identity assets only for GET and HEAD', async () => {
        const post = await call('/hero.png', { method: 'POST' });
        expect(post.response.status).toBe(405);
        expect(post.response.headers.get('allow')).toBe('GET, HEAD');
        expect((await call('/hero.png')).response.status).toBe(200);
        expect(state.served).toHaveLength(1);
    });

    test('reports unavailable image storage', async () => {
        state.serveError = true;
        const { response } = await call('/hero.png');
        expect(response.status).toBe(503);
        expect(state.captured).toHaveLength(1);
    });

    test('answers API preflights for the same origin only', async () => {
        const blocked = await call('/api/x', {
            method: 'OPTIONS',
            headers: { origin: 'https://evil.test' }
        });
        expect(blocked.response.status).toBe(403);
        const allowed = await call('/api/x', {
            method: 'OPTIONS',
            headers: { origin: 'https://admin.example.com', 'x-request-id': 'req-1' }
        });
        expect(allowed.response.status).toBe(204);
        expect(allowed.response.headers.get('x-request-id')).toBe('req-1');
        const noOrigin = await call('/api/x', { method: 'OPTIONS' });
        expect(noOrigin.response.status).toBe(204);
        expect(noOrigin.response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    });

    test('adds the policy to HTML and privacy headers to everything', async () => {
        state.respond = () =>
            new Response('<html></html>', { headers: { 'content-type': 'text/html' } });
        const { response } = await call('/');
        expect(response.headers.get('content-security-policy')).toContain('default-src');
        expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
        expect(response.headers.get('cache-control')).toBe('no-store');
    });

    test('tags API responses and wraps errors in the shared envelope', async () => {
        state.respond = () => Response.json({ ok: true });
        const ok = await call('/api/x', { headers: { 'x-request-id': 'req-2' } });
        expect(ok.response.headers.get('x-request-id')).toBe('req-2');
        expect(await ok.response.json()).toEqual({ ok: true });
        state.respond = () => new Response('missing', { status: 404 });
        const missing = await call('/api/x');
        expect(missing.response.status).toBe(404);
        expect(((await missing.response.json()) as any).error).toBeDefined();
    });

    test('drops the body of HEAD responses', async () => {
        const { response } = await call('/', { method: 'HEAD' });
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('');
    });
});

describe('Sentry setup', () => {
    test('reuses an existing client instead of starting another', async () => {
        const url = new URL('https://admin.example.com/api/x');
        const event: any = { request: new Request(url), url, platform: {}, locals: {} };
        const response = await passthrough.handle({
            event,
            resolve: async () => new Response('through')
        });
        expect(await response.text()).toBe('through');
    });
});
