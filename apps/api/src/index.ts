import { Hono, type Context } from 'hono';
import * as Sentry from '@sentry/cloudflare';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { stringify } from 'yaml';
import { createSupabaseRepositories } from '@idstead/data';
import { openapiSpec } from '#lib/openapi.ts';
import { getAuthor } from '#lib/server/api/author.ts';
import {
    getBlog,
    getBlogComments,
    getBlogContent,
    getBlogViews,
    getSearch,
    type ApiContext
} from '#lib/server/api/blog.ts';
import { getRoot } from '#lib/server/api/root.ts';
import { runApi } from '#lib/server/api/responses.ts';
import { apiErrorEnvelope, needsApiEnvelope } from '#lib/server/apiEnvelope.ts';
import { publicResponse } from '#lib/server/publicResponse.ts';
import { checkRateLimit, clientIp } from '#lib/server/rateLimit.ts';
import readme from './README.md';

export interface Env {
    PUBLIC_SUPABASE_URL?: string;
    PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
    PUBLIC_SENTRY_DSN?: string;
    PUBLIC_SENTRY_ENVIRONMENT?: string;
}

const ALLOW = 'GET, HEAD, OPTIONS';
const EXPOSED_HEADERS =
    'ETag, Link, X-Request-ID, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After, X-Checksum-SHA256, Repr-Digest, Content-Disposition';

let client: SupabaseClient | undefined;

function database(env: Env): SupabaseClient {
    client ??= createClient(
        (env.PUBLIC_SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, ''),
        env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
        { auth: { persistSession: false, autoRefreshToken: false } }
    );
    return client;
}

type AppEnv = { Bindings: Env; Variables: { requestId: string } };

function context(c: Context<AppEnv>): ApiContext {
    const db = database(c.env);
    const fetchFn: typeof fetch = (input, init) => fetch(input, init);
    return {
        url: new URL(c.req.url),
        request: c.req.raw,
        db,
        repos: createSupabaseRepositories(db, { fetch: fetchFn }),
        fetch: fetchFn
    };
}

function isPreview(url: URL, env: Env) {
    return env.PUBLIC_SENTRY_ENVIRONMENT === 'preview' || url.hostname.endsWith('.workers.dev');
}

const app = new Hono<AppEnv>({ strict: false });

app.use('*', async (c, next) => {
    const requestId = c.req.header('x-request-id') || crypto.randomUUID();
    c.set('requestId', requestId);
    const method = c.req.method;

    if (method === 'OPTIONS')
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': ALLOW,
                'Access-Control-Allow-Headers':
                    'Content-Type, Authorization, If-None-Match, Want-Repr-Digest',
                'Access-Control-Max-Age': '86400',
                'X-Request-ID': requestId
            }
        });

    const limit = await checkRateLimit(clientIp(c.req.raw));
    if (limit.limited)
        return apiErrorEnvelope(
            Response.json(
                {
                    code: 'RATE_LIMITED',
                    message: 'Rate limit exceeded. Please wait before retrying.'
                },
                { status: 429 }
            ),
            { requestId, publicCors: true, headers: limit.headers }
        );

    if (method !== 'GET' && method !== 'HEAD')
        return apiErrorEnvelope(new Response(null, { status: 405 }), {
            requestId,
            publicCors: true,
            allow: ALLOW,
            headers: limit.headers
        });

    await next();

    const url = new URL(c.req.url);
    let response = c.res;
    if (needsApiEnvelope(response)) {
        c.res = await apiErrorEnvelope(response, {
            requestId,
            publicCors: true,
            allow: ALLOW,
            noindex: isPreview(url, c.env),
            headers: limit.headers
        });
        return;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (
        response.status === 200
        && !response.headers.has('ETag')
        && !/application\/(pdf|zip|octet-stream)/.test(contentType)
    ) {
        const conditional = await publicResponse(
            c.req.raw,
            await response.clone().text(),
            contentType,
            60
        );
        response = new Response(conditional.status === 304 ? null : response.body, {
            status: conditional.status,
            headers: response.headers
        });
        response.headers.set('ETag', conditional.headers.get('ETag')!);
    } else {
        response = new Response(response.body, response);
    }

    response.headers.set('X-Request-ID', requestId);
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Expose-Headers', EXPOSED_HEADERS);
    response.headers.append('Vary', 'Accept');
    if (isPreview(url, c.env)) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    for (const [key, value] of Object.entries(limit.headers)) response.headers.set(key, value);
    if (method === 'HEAD') response = new Response(null, response);
    c.res = response;
});

app.get('/', c => c.redirect('/v1', 301));
app.get('/robots.txt', () => new Response('User-agent: *\nAllow: /\n'));

app.get('/v1', c => runApi(() => getRoot(context(c), readme)));
app.get('/v1/blog', c => runApi(() => getBlog(context(c))));
app.get('/v1/blog/content', c => runApi(() => getBlogContent(context(c))));
app.get('/v1/blog/comments', c => runApi(() => getBlogComments(context(c))));
app.get('/v1/blog/views', c => runApi(() => getBlogViews(context(c))));
app.get('/v1/author', c => runApi(() => getAuthor(context(c))));
app.get('/v1/cv', c => runApi(() => getAuthor(context(c), ['cv'])));
app.get('/v1/search', c => runApi(() => getSearch(context(c))));

function spec(c: Context<AppEnv>) {
    return { ...openapiSpec, servers: [{ url: new URL(c.req.url).origin }] };
}

app.get('/v1/openapi.json', c =>
    Response.json(spec(c), {
        headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300, must-revalidate' }
    })
);
app.get(
    '/v1/openapi.yaml',
    c =>
        new Response(stringify(spec(c)), {
            headers: {
                'Content-Type': 'application/yaml; charset=utf-8',
                'Cache-Control': 'public, max-age=0, s-maxage=300, must-revalidate'
            }
        })
);

app.notFound(() =>
    Response.json(
        { code: 'NOT_FOUND', message: 'Requested API endpoint or resource does not exist.' },
        { status: 404 }
    )
);

app.onError(error => {
    Sentry.captureException(error);
    return Response.json(
        {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred while processing the request.'
        },
        { status: 500 }
    );
});

export default Sentry.withSentry<Env>(
    env => ({
        dsn: env.PUBLIC_SENTRY_DSN || '',
        environment: env.PUBLIC_SENTRY_ENVIRONMENT || 'production',
        tracesSampleRate: 1.0
    }),
    { fetch: app.fetch } satisfies ExportedHandler<Env>
);
