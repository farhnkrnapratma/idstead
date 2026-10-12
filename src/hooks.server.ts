import { sequence } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import * as publicEnv from '$app/env/public';
import { dev } from '$app/env';
import { assetNames, serveIdentityAsset } from '#lib/server/profileAssets.ts';
import { publicResponse } from '#lib/server/publicResponse.ts';
import { createAuthClient, safeGetSession } from '#lib/server/supabaseAuth.ts';
import { privateRequestIntegrations } from '#lib/server/sentryPrivacy.ts';
import { buildContentSecurityPolicy } from '#lib/server/csp.ts';
import { workerBinding, type RateLimit } from '#lib/server/workerEnv.ts';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 60;

const sentryInitHandle: Handle =
    import.meta.hot?.data.sentryInitHandle
    ?? (Sentry.getClient() ?
        ({ event, resolve }) => resolve(event)
    :   Sentry.initCloudflareSentryHandle({
            dsn: publicEnv.PUBLIC_SENTRY_DSN || '',
            environment: publicEnv.PUBLIC_SENTRY_ENVIRONMENT || import.meta.env.MODE,
            tracesSampleRate: dev ? 0 : 1.0,
            integrations: privateRequestIntegrations()
        }));

if (import.meta.hot) {
    import.meta.hot.data.sentryInitHandle = sentryInitHandle;
}

function getCdnBaseUrl(): string {
    const base = (publicEnv.PUBLIC_CDN_BASE_URL ?? '').trim();
    return base.replace(/\/+$/, '');
}

interface RateLimitRecord {
    timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitRecord>();

function getClientIp(event: any): string {
    try {
        return (
            event.request.headers.get('cf-connecting-ip')
            || event.request.headers.get('x-forwarded-for')?.split(',')[0].trim()
            || event.getClientAddress?.()
            || '127.0.0.1'
        );
    } catch {
        return '127.0.0.1';
    }
}

function getStaticMimeType(pathname: string, defaultType: string | null): string {
    const ext = pathname.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'otf':
            return 'font/otf';
        case 'woff2':
            return 'font/woff2';
        case 'webmanifest':
        case 'json':
            return 'application/manifest+json';
        case 'ico':
            return 'image/x-icon';
        case 'png':
            return 'image/png';
        case 'svg':
            return 'image/svg+xml';
        default:
            return defaultType || 'application/octet-stream';
    }
}

export const handle: Handle = sequence(
    sentryInitHandle,
    Sentry.sentryHandle(),
    async ({ event, resolve }) => {
        event.locals.supabase = createAuthClient(event);
        event.locals.getAdminSession = safeGetSession(event.locals.supabase);

        const path = event.url.pathname;
        if ((path === '/admin' || path.startsWith('/admin/')) && path !== '/admin/login') {
            const session = await event.locals.getAdminSession();
            if (session?.role !== 'admin' || !session.mfaSatisfied)
                redirect(
                    303,
                    `/admin/login?redirectTo=${encodeURIComponent(path + event.url.search)}`
                );
        }

        return resolve(event, {
            filterSerializedResponseHeaders: name =>
                name === 'content-range' || name === 'x-supabase-api-version'
        });
    },
    async ({ event, resolve }) => {
        const requestId = event.request.headers.get('x-request-id') || crypto.randomUUID();

        if (event.url.hostname === 'www.fkp.my.id') {
            throw redirect(301, `https://fkp.my.id${event.url.pathname}${event.url.search}`, {
                external: ['https://fkp.my.id']
            });
        }

        if (
            assetNames.includes(event.url.pathname.slice(1))
            || event.url.pathname === '/hero.png'
        ) {
            if (!['GET', 'HEAD'].includes(event.request.method))
                return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
            try {
                return await serveIdentityAsset(event.request, event.url, event.platform);
            } catch (error) {
                Sentry.captureException(error);
                return new Response('Image storage unavailable.', {
                    status: 503,
                    headers: { 'Cache-Control': 'no-store' }
                });
            }
        }

        const cdnBaseUrl = getCdnBaseUrl();

        if (
            event.url.pathname.startsWith('/static/')
            || event.url.pathname.startsWith('/fonts/')
            || event.url.pathname.startsWith('/logo/')
        ) {
            if (!cdnBaseUrl) {
                return new Response('Configuration Error: PUBLIC_CDN_BASE_URL is not configured.', {
                    status: 500,
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                });
            }

            try {
                let cdnRes = await fetch(`${cdnBaseUrl}${event.url.pathname}`);
                if (!cdnRes.ok && !event.url.pathname.startsWith('/static/')) {
                    const fallbackRes = await fetch(`${cdnBaseUrl}/static${event.url.pathname}`);
                    if (fallbackRes.ok) {
                        cdnRes = fallbackRes;
                    }
                }

                if (cdnRes.ok) {
                    const mime = getStaticMimeType(
                        event.url.pathname,
                        cdnRes.headers.get('content-type')
                    );

                    return new Response(cdnRes.body, {
                        status: 200,
                        headers: {
                            'Content-Type': mime,
                            'Access-Control-Allow-Origin': '*',
                            'Cache-Control': 'public, max-age=31536000, immutable'
                        }
                    });
                }

                return new Response(`Static asset not found on CDN: ${event.url.pathname}`, {
                    status: cdnRes.status,
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                });
            } catch {
                return new Response('CDN Gateway Error: Failed to fetch static asset from CDN.', {
                    status: 502,
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                });
            }
        }

        const pathname = event.url.pathname.toLowerCase().replace(/\/$/, '');

        if (['/blog', '/projects', '/contact', '/cv', '/funding', '/home'].includes(pathname)) {
            const section = pathname.replace('/', '');
            throw redirect(307, `/#${section}`);
        }

        const isApiRequest =
            event.url.pathname.startsWith('/api/') || event.url.pathname === '/api';
        const isInternalApi =
            event.url.pathname === '/api/internal'
            || event.url.pathname.startsWith('/api/internal/');
        const isAdminApi =
            event.url.pathname.startsWith('/api/internal/admin/')
            && event.url.pathname !== '/api/internal/admin/login';
        const isArdRequest =
            event.url.pathname === '/api/ard' || event.url.pathname.startsWith('/api/ard/');
        const isArdSearchRequest = event.url.pathname.replace(/\/$/, '') === '/api/ard/search';
        const isArdExploreRequest = event.url.pathname.replace(/\/$/, '') === '/api/ard/explore';
        const isArdAgentsRequest = event.url.pathname.replace(/\/$/, '') === '/api/ard/agents';

        if (isApiRequest && event.request.method === 'OPTIONS') {
            const origin = event.request.headers.get('origin');
            if (isInternalApi && origin && origin !== event.url.origin)
                return new Response(null, {
                    status: 403,
                    headers: { 'Cache-Control': 'no-store' }
                });
            return new Response(null, {
                status: 204,
                headers: {
                    ...(isInternalApi ? {} : { 'Access-Control-Allow-Origin': '*' }),
                    'Access-Control-Allow-Methods':
                        isInternalApi ? 'GET, HEAD, POST, OPTIONS'
                        : isArdSearchRequest || isArdExploreRequest ? 'POST, OPTIONS'
                        : isArdAgentsRequest ? 'GET, HEAD, OPTIONS'
                        : 'GET, HEAD, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, If-None-Match',
                    'Access-Control-Max-Age': '86400',
                    'X-Request-ID': requestId
                }
            });
        }

        let rateLimitHeaders: Record<string, string> = {};

        if (isApiRequest && !isAdminApi) {
            const clientIp = getClientIp(event);
            const now = Date.now();
            for (const [key, value] of rateLimitMap) {
                if (!value.timestamps.some(time => time > now - RATE_LIMIT_WINDOW_MS))
                    rateLimitMap.delete(key);
            }
            if (rateLimitMap.size >= 10000 && !rateLimitMap.has(clientIp))
                rateLimitMap.delete(rateLimitMap.keys().next().value!);
            const record = rateLimitMap.get(clientIp) || { timestamps: [] };

            record.timestamps = record.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);

            const limiter = await workerBinding<RateLimit>('API_RATE_LIMITER');
            const isLimited =
                limiter ?
                    !(await limiter.limit({ key: clientIp })).success
                :   record.timestamps.length >= MAX_REQUESTS_PER_WINDOW;

            if (isLimited) {
                const oldest = record.timestamps[0] ?? now;
                const resetSeconds = Math.max(
                    1,
                    Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000)
                );
                return new Response(
                    JSON.stringify({
                        ...(isArdRequest ?
                            {
                                errorCode: 'RATE_LIMIT_EXCEEDED',
                                message: 'Rate limit exceeded. Please wait before retrying.'
                            }
                        :   {
                                error: {
                                    code: 'RATE_LIMITED',
                                    message: 'Rate limit exceeded. Please wait before retrying.'
                                }
                            })
                    }),
                    {
                        status: 429,
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Cache-Control': 'no-store',
                            'X-Request-ID': requestId,
                            ...(isInternalApi ? {} : { 'Access-Control-Allow-Origin': '*' }),
                            'Retry-After': String(resetSeconds > 0 ? resetSeconds : 60),
                            'X-RateLimit-Limit': String(MAX_REQUESTS_PER_WINDOW),
                            'X-RateLimit-Remaining': '0',
                            'X-RateLimit-Reset': String(
                                Math.floor(
                                    (now + (resetSeconds > 0 ? resetSeconds : 60) * 1000) / 1000
                                )
                            )
                        }
                    }
                );
            }

            record.timestamps.push(now);
            rateLimitMap.set(clientIp, record);

            const remaining = MAX_REQUESTS_PER_WINDOW - record.timestamps.length;
            const resetTime = Math.floor((now + RATE_LIMIT_WINDOW_MS) / 1000);

            rateLimitHeaders = {
                'X-RateLimit-Limit': String(MAX_REQUESTS_PER_WINDOW),
                'X-RateLimit-Remaining': String(remaining),
                'X-RateLimit-Reset': String(resetTime)
            };
        }

        let response = await resolve(event, {
            transformPageChunk: ({ html }) => {
                const cdn = getCdnBaseUrl();
                return cdn ? html.replaceAll(`${cdn}//`, `${cdn}/`) : html;
            }
        });
        const contentType = response.headers.get('content-type') ?? '';
        const privatePage =
            event.url.pathname === '/admin'
            || event.url.pathname.startsWith('/admin/')
            || isInternalApi;
        const preview =
            publicEnv.PUBLIC_SENTRY_ENVIRONMENT === 'preview'
            || event.url.hostname.endsWith('.pages.dev');
        if (contentType.includes('text/html')) {
            response.headers.set(
                'Content-Security-Policy',
                buildContentSecurityPolicy({
                    supabaseUrl: publicEnv.PUBLIC_SUPABASE_URL,
                    sentryDsn: publicEnv.PUBLIC_SENTRY_DSN,
                    cdnBaseUrl: publicEnv.PUBLIC_CDN_BASE_URL,
                    dev
                })
            );
        }
        if (privatePage || preview) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
        if (privatePage || response.status >= 400)
            response.headers.set('Cache-Control', 'no-store');
        if (isApiRequest && !isInternalApi) {
            response.headers.append('Vary', 'Accept');
            response.headers.set(
                'Access-Control-Expose-Headers',
                'ETag, Link, X-Request-ID, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After, X-Checksum-SHA256, Repr-Digest, Content-Disposition'
            );
        }

        if (isApiRequest) {
            response.headers.set('X-Request-ID', requestId);
            if (!isInternalApi) {
                response.headers.set('Access-Control-Allow-Origin', '*');
            }
        }

        if (isApiRequest && !isAdminApi) {
            for (const [hKey, hVal] of Object.entries(rateLimitHeaders)) {
                response.headers.set(hKey, hVal);
            }
        }

        if (isApiRequest && (response.status >= 400 || contentType.includes('text/html'))) {
            const httpStatus = response.status >= 400 ? response.status : 404;

            const DEFAULT_CODES: Record<number, string> = {
                400: 'BAD_REQUEST',
                401: 'UNAUTHORIZED',
                403: 'FORBIDDEN',
                404: 'NOT_FOUND',
                405: 'METHOD_NOT_ALLOWED',
                429: 'RATE_LIMITED'
            };
            const DEFAULT_MESSAGES: Record<number, string> = {
                400: 'The request was invalid.',
                401: 'Authentication is required to access this privileged endpoint.',
                403: 'You do not have permission to access this privileged resource.',
                404: 'Requested API endpoint or resource does not exist.',
                405: 'This HTTP method is not supported for this endpoint.',
                429: 'Rate limit exceeded. Please wait before retrying.'
            };

            const ARD_DEFAULT_CODES: Record<number, string> = {
                400: 'INVALID_ARGUMENT',
                401: 'UNAUTHENTICATED',
                403: 'UNAUTHENTICATED',
                404: 'NOT_FOUND',
                405: 'INVALID_ARGUMENT',
                429: 'RATE_LIMIT_EXCEEDED'
            };
            let errorCode =
                isArdRequest ?
                    (ARD_DEFAULT_CODES[httpStatus] ?? 'INTERNAL_ERROR')
                :   (DEFAULT_CODES[httpStatus] ?? 'INTERNAL_ERROR');
            let errorMessage =
                DEFAULT_MESSAGES[httpStatus]
                ?? 'An unexpected error occurred while processing the request.';
            let errorDetails: string | undefined;

            if (contentType.includes('application/json')) {
                try {
                    const jsonBody = await response.clone().json();
                    if (jsonBody && typeof jsonBody === 'object') {
                        const isSensitive = (text: string) =>
                            /row-level security|violates|postgres|supabase|column|relation|syntax error|duplicate key|PGRST|permission denied/i.test(
                                text
                            );

                        if (
                            isArdRequest
                            && typeof jsonBody.errorCode === 'string'
                            && jsonBody.errorCode
                        ) {
                            errorCode = jsonBody.errorCode;
                        } else if (
                            !isArdRequest
                            && typeof jsonBody.code === 'string'
                            && jsonBody.code
                        ) {
                            errorCode = jsonBody.code;
                        }

                        const rawMessage = String(jsonBody.message ?? jsonBody.error ?? '').trim();
                        if (rawMessage && !isSensitive(rawMessage)) {
                            errorMessage = rawMessage.replace(/^\d{3}\s+[^:]+:\s*/, '');
                        }

                        const rawDetails = String(jsonBody.details ?? '').trim();
                        if (rawDetails && !isSensitive(rawDetails)) {
                            errorDetails = rawDetails;
                        }
                    }
                } catch (err) {}
            }

            const errHeaders: Record<string, string> = {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'no-store',
                'X-Request-ID': requestId,
                ...(privatePage || preview ? { 'X-Robots-Tag': 'noindex, nofollow' } : {}),
                ...(httpStatus === 405 ?
                    {
                        Allow:
                            isArdSearchRequest || isArdExploreRequest ? 'POST, OPTIONS'
                            : isArdAgentsRequest ? 'GET, HEAD, OPTIONS'
                            : isArdRequest ? 'GET, HEAD, POST, OPTIONS'
                            : isInternalApi ? (response.headers.get('allow') ?? 'GET, HEAD, POST')
                            : 'GET, HEAD, OPTIONS'
                    }
                :   {}),
                ...(isInternalApi ?
                    {}
                :   {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Expose-Headers': 'X-Request-ID, Retry-After'
                    }),
                ...rateLimitHeaders
            };

            return new Response(
                JSON.stringify(
                    isArdRequest ?
                        { errorCode, message: errorMessage }
                    :   {
                            error: {
                                code: errorCode,
                                message: errorMessage,
                                ...(errorDetails ? { details: errorDetails } : {})
                            }
                        }
                ),
                { status: httpStatus, headers: errHeaders }
            );
        }

        if (contentType.includes('text/html')) {
            response.headers.append('Link', '</.well-known/api-catalog>; rel="api-catalog"');
            response.headers.append(
                'Link',
                '</.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"'
            );
            response.headers.append(
                'Link',
                '</.well-known/ard.json>; rel="ard"; type="application/json"'
            );
            response.headers.append('Link', '</llms.txt>; rel="describedby"; type="text/markdown"');
            response.headers.append(
                'Link',
                '</sitemap.xml>; rel="sitemap"; type="application/xml"'
            );
        }

        if (
            response.status === 200
            && ['GET', 'HEAD'].includes(event.request.method)
            && ((isApiRequest && !isInternalApi) || event.url.pathname.startsWith('/.well-known/'))
            && !response.headers.has('ETag')
            && !contentType.includes('application/pdf')
        ) {
            const conditional = await publicResponse(
                event.request,
                await response.clone().text(),
                contentType,
                60
            );
            response.headers.set('ETag', conditional.headers.get('ETag')!);
            if (conditional.status === 304)
                response = new Response(null, { status: 304, headers: response.headers });
        }
        if (event.request.method === 'HEAD' && response.body)
            response = new Response(null, { status: response.status, headers: response.headers });
        return response;
    }
);

export const handleError = Sentry.handleErrorWithSentry();
