// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { more, slot, slots } from './support.ts';

const state = {
    client: false,
    limit: { limited: false, headers: {} as Record<string, string> },
    analytics: null as null | { settings: Record<string, unknown> },
    head: '<script>window.a=1</script>',
    serveError: false,
    served: [] as string[],
    captured: [] as unknown[],
    resolved: [] as Array<{ pathname: string; chunk?: string }>,
    respond: (() =>
        new Response('<html></html>', { headers: { 'content-type': 'text/html' } })) as (
        event: any
    ) => Response,
    fetched: [] as string[],
    fetchResponse: new Response('# md', {
        status: 200,
        headers: { 'content-type': 'text/markdown' }
    })
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
mock.module('../../packages/lib/src/server/csrf.ts', () => ({
    csrfHandle: (input: any) => input.resolve(input.event)
}));
mock.module('../../packages/lib/src/server/pageDataCache.ts', () => ({
    pageDataCache: (input: any) => input.resolve(input.event)
}));
more.serveIdentityAsset = async (request: Request) => {
    if (state.serveError) throw new Error('storage');
    state.served.push(request.url);
    return new Response('image', { headers: { 'content-type': 'image/webp' } });
};
slots.checkRateLimit = async () => state.limit;
mock.module('../../packages/lib/src/server/analytics.ts', () => ({
    siteAnalytics: async () => state.analytics,
    analyticsHead: () => state.head,
    analyticsSources: () => ({ script: [], connect: [] })
}));
slot.publicRepositories = () => ({});

const loaded = new Map<boolean, (input: any) => Promise<Response>>();

async function load(client: boolean) {
    state.client = client;
    const target = `../../apps/web/src/hooks.server.ts?client=${client}`;
    const module = (await import(target)) as { handle: (input: any) => Promise<Response> };
    loaded.set(client, module.handle);
    return module.handle;
}

const handle = await load(false);
const passthroughHandle = await load(true);

interface Options {
    method?: string;
    host?: string;
    headers?: Record<string, string>;
    path: string;
    search?: string;
    handler?: (input: any) => Promise<Response>;
}

async function call({
    method = 'GET',
    host = 'example.com',
    path,
    headers,
    search = '',
    handler = handle
}: Options) {
    const url = new URL(`https://${host}${path}${search}`);
    const event: any = {
        request: new Request(url, { method, headers }),
        url,
        platform: {},
        locals: {},
        fetch: async (input: string) => {
            state.fetched.push(input);
            return state.fetchResponse.clone();
        },
        getClientAddress: () => '203.0.113.9',
        setHeaders: () => {},
        isDataRequest: false,
        isSubRequest: false
    };
    return handler({
        event,
        resolve: async (inner: any, options?: any) => {
            state.resolved.push({
                pathname: inner.url.pathname,
                chunk: options?.transformPageChunk?.({
                    html: '<head>%idstead.analytics%</head><img src="https://cdn.example.com//a.png">'
                })
            });
            return state.respond(inner);
        }
    });
}

const html = (
    init: ResponseInit = {},
    body = '<html><body><main><h1>Hi</h1></main></body></html>'
) =>
    new Response(body, {
        ...init,
        headers: { 'content-type': 'text/html', ...(init.headers as Record<string, string>) }
    });
const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, init);

beforeEach(() => {
    state.limit = { limited: false, headers: {} };
    state.analytics = null;
    state.head = '<script>window.a=1</script>';
    state.serveError = false;
    state.served = [];
    state.captured = [];
    state.resolved = [];
    state.fetched = [];
    state.fetchResponse = new Response('# md', {
        status: 200,
        headers: { 'content-type': 'text/markdown' }
    });
    state.respond = () => html();
});

describe('web handle', () => {
    test('redirects the www host to the apex', async () => {
        let thrown: any;
        try {
            await call({ host: 'www.example.com', path: '/blog', search: '?page=2' });
        } catch (error) {
            thrown = error;
        }
        expect(thrown.status).toBe(301);
        expect(thrown.location).toBe('https://example.com/blog?page=2');
    });

    test('serves identity assets and guards methods and storage failures', async () => {
        expect((await call({ path: '/avatar.webp' })).status).toBe(200);
        expect((await call({ path: '/hero.png', method: 'HEAD' })).status).toBe(200);
        const denied = await call({ path: '/avatar.webp', method: 'POST' });
        expect(denied.status).toBe(405);
        expect(denied.headers.get('Allow')).toBe('GET, HEAD');
        state.serveError = true;
        const failed = await call({ path: '/banner.webp' });
        expect(failed.status).toBe(503);
        expect(state.captured).toHaveLength(1);
    });

    test('answers CORS preflights', async () => {
        const publicApi = await call({
            path: '/api/v1/posts',
            method: 'OPTIONS',
            headers: { 'x-request-id': 'req-1' }
        });
        expect(publicApi.status).toBe(204);
        expect(publicApi.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(publicApi.headers.get('Access-Control-Allow-Methods')).toBe('GET, HEAD, OPTIONS');
        expect(publicApi.headers.get('X-Request-ID')).toBe('req-1');

        const ard = await call({ path: '/api/ard/search/', method: 'OPTIONS' });
        expect(ard.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
        const ardExplore = await call({ path: '/api/ard/explore', method: 'OPTIONS' });
        expect(ardExplore.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');

        const internal = await call({ path: '/api/internal/x', method: 'OPTIONS' });
        expect(internal.headers.get('Access-Control-Allow-Origin')).toBeNull();
        expect(internal.headers.get('Access-Control-Allow-Methods')).toBe(
            'GET, HEAD, POST, OPTIONS'
        );
        const sameOrigin = await call({
            path: '/api/internal/x',
            method: 'OPTIONS',
            headers: { origin: 'https://example.com' }
        });
        expect(sameOrigin.status).toBe(204);
        const crossOrigin = await call({
            path: '/api/internal/x',
            method: 'OPTIONS',
            headers: { origin: 'https://evil.example' }
        });
        expect(crossOrigin.status).toBe(403);
        expect((await call({ path: '/api', method: 'OPTIONS' })).status).toBe(204);
    });

    test('limits API requests with the right error shape', async () => {
        state.limit = { limited: true, headers: { 'Retry-After': '30' } };
        const publicLimited = await call({ path: '/api/v1/posts' });
        expect(publicLimited.status).toBe(429);
        expect(await publicLimited.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
        expect(publicLimited.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(publicLimited.headers.get('Retry-After')).toBe('30');

        const ard = await call({ path: '/api/ard/search', method: 'POST' });
        expect(await ard.json()).toMatchObject({ errorCode: 'RATE_LIMIT_EXCEEDED' });

        const internal = await call({ path: '/api/internal/contact', method: 'POST' });
        expect(internal.status).toBe(429);
        expect(internal.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    test('adds analytics, csp and discovery links to html pages', async () => {
        state.analytics = { settings: { provider: 'x' } };
        const page = await call({ path: '/blog' });
        expect(page.headers.get('Content-Security-Policy')).toContain('default-src');
        expect(page.headers.get('Link')).toContain('api.example.com');
        expect(page.headers.get('Vary')).toContain('Accept');
        expect(state.resolved.at(-1)!.chunk).toContain('window.a=1');
        expect(state.resolved.at(-1)!.chunk).toContain('https://cdn.example.com/a.png');

        state.analytics = null;
        state.head = '';
        const plain = await call({ path: '/blog' });
        expect(plain.headers.get('Content-Security-Policy')).toBeTruthy();
    });

    test('marks previews and errors', async () => {
        state.respond = () => html({ status: 404 });
        const missing = await call({ path: '/nope', host: 'site.workers.dev' });
        expect(missing.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
        expect(missing.headers.get('Cache-Control')).toBe('no-store');
        state.respond = () => html();
        expect(
            (await call({ path: '/', host: 'site.pages.dev' })).headers.get('X-Robots-Tag')
        ).toBe('noindex, nofollow');
        expect((await call({ path: '/' })).headers.get('X-Robots-Tag')).toBeNull();
    });

    test('decorates public API responses and caches by etag', async () => {
        state.respond = () => json({ ok: true });
        const first = await call({ path: '/api/v1/posts' });
        expect(first.status).toBe(200);
        expect(first.headers.get('ETag')).toBeTruthy();
        expect(first.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(first.headers.get('Access-Control-Expose-Headers')).toContain('ETag');
        expect(first.headers.get('X-Request-ID')).toBeTruthy();

        const conditional = await call({
            path: '/api/v1/posts',
            headers: { 'if-none-match': first.headers.get('ETag')! }
        });
        expect(conditional.status).toBe(304);

        state.limit = { limited: false, headers: { 'X-RateLimit-Limit': '60' } };
        const limited = await call({ path: '/api/v1/posts' });
        expect(limited.headers.get('X-RateLimit-Limit')).toBe('60');

        state.respond = () => json({ ok: true }, { headers: { ETag: '"fixed"' } });
        expect((await call({ path: '/api/v1/posts' })).headers.get('ETag')).toBe('"fixed"');
        state.respond = () =>
            new Response('%PDF', { headers: { 'content-type': 'application/pdf' } });
        expect((await call({ path: '/api/v1/resume' })).headers.get('ETag')).toBeNull();
        state.respond = () =>
            new Response('bin', { headers: { 'content-type': 'application/octet-stream' } });
        expect((await call({ path: '/api/v1/export' })).headers.get('ETag')).toBeNull();
        state.respond = () => json({ jwks: [] });
        expect((await call({ path: '/.well-known/jwks.json' })).headers.get('ETag')).toBeTruthy();

        state.respond = () => json({ ok: true });
        const head = await call({ path: '/api/v1/posts', method: 'HEAD' });
        expect(head.body).toBeNull();
        expect(head.headers.get('ETag')).toBeTruthy();
    });

    test('keeps internal API responses private', async () => {
        state.respond = () => json({ ok: true });
        const internal = await call({ path: '/api/internal/contact', method: 'POST' });
        expect(internal.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
        expect(internal.headers.get('Cache-Control')).toBe('no-store');
        expect(internal.headers.get('Access-Control-Allow-Origin')).toBeNull();
        expect(internal.headers.get('ETag')).toBeNull();
    });

    test('wraps API errors and html fallbacks in the error envelope', async () => {
        state.respond = () => json({ message: 'gone' }, { status: 404 });
        const missing = await call({ path: '/api/v1/missing' });
        expect(missing.status).toBe(404);
        expect(await missing.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });

        state.respond = () => html();
        const fallback = await call({ path: '/api/v1/unknown' });
        expect(fallback.status).toBe(404);

        state.respond = () => json({ message: 'bad' }, { status: 400 });
        const ard = await call({ path: '/api/ard/search', method: 'POST' });
        expect(await ard.json()).toMatchObject({ errorCode: 'INVALID_ARGUMENT' });

        const internal = await call({ path: '/api/internal/x', method: 'POST' });
        expect(internal.status).toBe(400);
        state.limit = { limited: false, headers: { 'X-RateLimit-Limit': '5' } };
        state.respond = () => html({ status: 405 });
        const method = await call({ path: '/api/internal/y', method: 'POST' });
        expect(method.headers.get('Allow')).toBeTruthy();
    });

    test('negotiates markdown for pages and posts', async () => {
        const accept = { accept: 'text/markdown' };
        const post = await call({ path: '/blog/my-post', headers: accept });
        expect(post.headers.get('content-type')).toContain('text/markdown');
        expect(state.fetched).toEqual(['/blog/my-post.md']);

        state.fetchResponse = new Response('missing', { status: 404 });
        const converted = await call({ path: '/blog/my-post', headers: accept });
        expect(converted.headers.get('content-type')).toContain('text/markdown');
        expect(await converted.text()).toContain('# Hi');

        const home = await call({ path: '/', headers: accept });
        expect(home.headers.get('x-markdown-tokens')).toBeTruthy();
        const head = await call({ path: '/', headers: accept, method: 'HEAD' });
        expect(head.body).toBeNull();

        state.respond = () => html({ status: 500 });
        const failing = await call({ path: '/', headers: accept });
        expect(failing.status).toBe(500);
        state.respond = () => new Response('plain', { headers: { 'content-type': 'text/plain' } });
        const text = await call({ path: '/', headers: accept });
        expect(text.headers.get('content-type')).toContain('text/plain');

        state.respond = () => html();
        const postForm = await call({ path: '/', headers: accept, method: 'POST' });
        expect(postForm.headers.get('Vary')).toContain('Accept');
        const asset = await call({ path: '/file.txt', headers: accept });
        expect(asset.headers.get('content-type')).toContain('text/html');
    });

    test('reuses an existing sentry client', async () => {
        const response = await call({ path: '/', handler: passthroughHandle });
        expect(response.status).toBe(200);
    });
});
