// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, mock, test } from 'bun:test';

const state = {
    limit: { limited: false, headers: {} as Record<string, string> },
    handler: (async () => Response.json({ ok: true })) as () => Promise<Response>,
    captured: [] as unknown[],
    contexts: [] as any[],
    configs: [] as Array<Record<string, unknown>>
};

mock.module('@sentry/cloudflare', () => ({
    captureException: (error: unknown) => void state.captured.push(error),
    withSentry: (config: (env: any) => Record<string, unknown>, handler: unknown) => {
        state.configs.push(
            config({}),
            config({ PUBLIC_SENTRY_DSN: 'dsn', PUBLIC_SENTRY_ENVIRONMENT: 'preview' })
        );
        return handler;
    }
}));
mock.module('../../packages/lib/src/server/data.ts', () => ({
    dataStores: (platform: unknown, options: unknown) => {
        state.contexts.push({ platform, options });
        return { public: { marker: 'repos' } };
    }
}));
mock.module('../../packages/lib/src/server/rateLimit.ts', () => ({
    checkRateLimit: async () => state.limit,
    clientIp: () => '203.0.113.9'
}));
const route = (name: string) => async (context: any) => {
    state.contexts.push({ route: name, url: context.url.pathname, repos: context.repos });
    return state.handler();
};
mock.module('../../packages/lib/src/server/api/analytics.ts', () => ({
    getAnalytics: route('analytics')
}));
mock.module('../../packages/lib/src/server/api/author.ts', () => ({ getAuthor: route('author') }));
mock.module('../../packages/lib/src/server/api/blog.ts', () => ({
    getBlog: route('blog'),
    getBlogComments: route('comments'),
    getBlogContent: route('content'),
    getBlogViews: route('views'),
    getSearch: route('search')
}));
mock.module('../../packages/lib/src/server/api/root.ts', () => ({
    getRoot: async (context: any, readme: string) => {
        state.contexts.push({ route: 'root', readme: typeof readme });
        return state.handler();
    }
}));
mock.module('../../packages/lib/src/server/api/responses.ts', () => ({
    runApi: (run: () => Promise<Response>) => run()
}));

const target = '../../apps/api/src/index.ts';
const worker = (await import(target)).default as unknown as {
    fetch: (request: Request, env: Record<string, string>, ctx: unknown) => Promise<Response>;
};

async function call(
    path: string,
    init: RequestInit = {},
    env: Record<string, string> = {},
    host = 'api.example.com'
) {
    return worker.fetch(new Request(`https://${host}${path}`, init), env, {});
}

beforeEach(() => {
    state.limit = { limited: false, headers: {} };
    state.handler = async () => Response.json({ ok: true });
    state.captured = [];
    state.contexts = [];
});

describe('api worker', () => {
    test('configures sentry from the environment', () => {
        expect(state.configs[0]).toMatchObject({ dsn: '', environment: 'production' });
        expect(state.configs[1]).toMatchObject({ dsn: 'dsn', environment: 'preview' });
    });

    test('answers preflights before anything else', async () => {
        const response = await call('/v1/blog', {
            method: 'OPTIONS',
            headers: { 'x-request-id': 'req-9' }
        });
        expect(response.status).toBe(204);
        expect(response.headers.get('X-Request-ID')).toBe('req-9');
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, HEAD, OPTIONS');
    });

    test('limits requests and rejects write methods', async () => {
        state.limit = { limited: true, headers: { 'Retry-After': '9' } };
        const limited = await call('/v1/blog');
        expect(limited.status).toBe(429);
        expect(limited.headers.get('Retry-After')).toBe('9');
        state.limit = { limited: false, headers: { 'X-RateLimit-Limit': '60' } };
        const post = await call('/v1/blog', { method: 'POST' });
        expect(post.status).toBe(405);
        expect(post.headers.get('Allow')).toBe('GET, HEAD, OPTIONS');
        expect((await post.json()).error.code).toBe('METHOD_NOT_ALLOWED');
    });

    test('serves json with etag, cors and rate limit headers', async () => {
        state.limit = { limited: false, headers: { 'X-RateLimit-Limit': '60' } };
        const response = await call('/v1/blog');
        expect(response.status).toBe(200);
        expect(response.headers.get('ETag')).toBeTruthy();
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Access-Control-Expose-Headers')).toContain('Repr-Digest');
        expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
        expect(response.headers.get('X-Robots-Tag')).toBeNull();
        expect(response.headers.get('Vary')).toContain('Accept');

        const conditional = await call('/v1/blog', {
            headers: { 'if-none-match': response.headers.get('ETag')! }
        });
        expect(conditional.status).toBe(304);

        const head = await call('/v1/blog', { method: 'HEAD' });
        expect(head.body).toBeNull();
        expect(head.status).toBe(200);
    });

    test('marks preview deployments noindex', async () => {
        const byEnv = await call('/v1/blog', {}, { PUBLIC_SENTRY_ENVIRONMENT: 'preview' });
        expect(byEnv.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
        const byHost = await call('/v1/blog', {}, {}, 'api.workers.dev');
        expect(byHost.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
        state.handler = async () => Response.json({ message: 'x' }, { status: 404 });
        const missing = await call('/v1/blog', {}, {}, 'api.workers.dev');
        expect(missing.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    });

    test('keeps existing etags and binary responses untouched', async () => {
        state.handler = async () => Response.json({ ok: true }, { headers: { ETag: '"fixed"' } });
        expect((await call('/v1/blog')).headers.get('ETag')).toBe('"fixed"');
        for (const type of ['application/pdf', 'application/zip', 'application/octet-stream']) {
            state.handler = async () => new Response('bin', { headers: { 'content-type': type } });
            expect((await call('/v1/resume')).headers.get('ETag')).toBeNull();
        }
    });

    test('routes every endpoint to its handler', async () => {
        for (const path of [
            '/v1',
            '/v1/blog',
            '/v1/blog/content',
            '/v1/blog/comments',
            '/v1/blog/views',
            '/v1/author',
            '/v1/resume',
            '/v1/search',
            '/v1/analytics'
        ])
            expect((await call(path)).status).toBe(200);
        const names = state.contexts.map(entry => entry.route).filter(Boolean);
        expect(names).toEqual([
            'root',
            'blog',
            'content',
            'comments',
            'views',
            'author',
            'author',
            'search',
            'analytics'
        ]);
        expect(state.contexts.find(entry => entry.options)?.options).toMatchObject({
            bannerUrls: false
        });
        expect(state.contexts.find(entry => entry.repos)?.repos).toEqual({ marker: 'repos' });
    });

    test('redirects the root and serves robots and the specs', async () => {
        const root = await call('/');
        expect(root.status).toBe(301);
        expect(root.headers.get('location')).toContain('/v1');
        const robots = await call('/robots.txt');
        expect(await robots.text()).toContain('User-agent');
        const json = await call('/v1/openapi.json');
        expect((await json.json()).servers).toEqual([{ url: 'https://api.example.com' }]);
        const yaml = await call('/v1/openapi.yaml');
        expect(yaml.headers.get('content-type')).toContain('application/yaml');
        expect(await yaml.text()).toContain('https://api.example.com');
    });

    test('wraps missing endpoints and failures in the error envelope', async () => {
        const missing = await call('/v1/nothing');
        expect(missing.status).toBe(404);
        expect((await missing.json()).error.code).toBe('NOT_FOUND');
        state.handler = async () => {
            throw new Error('boom');
        };
        const failed = await call('/v1/blog');
        expect(failed.status).toBe(500);
        expect(state.captured).toHaveLength(1);
        state.handler = async () =>
            new Response('<html></html>', { headers: { 'content-type': 'text/html' } });
        const html = await call('/v1/blog');
        expect(html.status).toBe(404);
    });
});
