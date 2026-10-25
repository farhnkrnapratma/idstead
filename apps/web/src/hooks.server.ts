import { sequence } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { writeFreezeHandle } from '#lib/server/writeFreeze.ts';
import { csrfHandle } from '#lib/server/csrf.ts';
import * as publicEnv from '$app/env/public';
import { dev } from '$app/env';
import { assetNames, serveIdentityAsset } from '#lib/server/profileAssets.ts';
import { publicResponse } from '#lib/server/publicResponse.ts';
import { privateRequestIntegrations } from '#lib/server/sentryPrivacy.ts';
import { buildContentSecurityPolicy } from '#lib/server/csp.ts';
import { apiErrorEnvelope, needsApiEnvelope } from '#lib/server/apiEnvelope.ts';
import { checkRateLimit, clientIp } from '#lib/server/rateLimit.ts';
import { apiBaseUrl } from '#lib/apiConfig.ts';
import { pageDataCache } from '#lib/server/pageDataCache.ts';

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

function getStaticMimeType(pathname: string, defaultType: string | null): string {
    const ext = pathname.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'otf':
            return 'font/otf';
        case 'woff2':
            return 'font/woff2';
        case 'webmanifest':
            return 'application/manifest+json';
        case 'json':
            return pathname.endsWith('/manifest.json') ?
                    'application/manifest+json'
                :   'application/json; charset=utf-8';
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

const PUBLIC_API_EXPOSED_HEADERS =
    'ETag, Link, X-Request-ID, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After, X-Checksum-SHA256, Repr-Digest, Content-Disposition';

export const handle: Handle = sequence(
    sentryInitHandle,
    Sentry.sentryHandle(),
    csrfHandle,
    async ({ event, resolve }) => {
        const requestId = event.request.headers.get('x-request-id') || crypto.randomUUID();

        if (event.url.hostname.startsWith('www.')) {
            const apex = `${event.url.protocol}//${event.url.host.slice(4)}`;
            throw redirect(301, `${apex}${event.url.pathname}${event.url.search}`, {
                external: [apex]
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
            if (!['GET', 'HEAD'].includes(event.request.method))
                return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
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

        if (event.url.pathname.toLowerCase().replace(/\/$/, '') === '/home') {
            throw redirect(308, '/');
        }

        const isApiRequest =
            event.url.pathname.startsWith('/api/') || event.url.pathname === '/api';
        const isInternalApi =
            event.url.pathname === '/api/internal'
            || event.url.pathname.startsWith('/api/internal/');
        const isArdRequest =
            event.url.pathname === '/api/ard' || event.url.pathname.startsWith('/api/ard/');
        const ardPath = event.url.pathname.replace(/\/$/, '');
        const isArdPostRequest = ardPath === '/api/ard/search' || ardPath === '/api/ard/explore';
        const publicAllow = isArdPostRequest ? 'POST, OPTIONS' : 'GET, HEAD, OPTIONS';

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
                        isInternalApi ? 'GET, HEAD, POST, OPTIONS' : publicAllow,
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, If-None-Match',
                    'Access-Control-Max-Age': '86400',
                    'X-Request-ID': requestId
                }
            });
        }

        let rateLimitHeaders: Record<string, string> = {};

        if (isApiRequest) {
            const limit = await checkRateLimit(clientIp(event.request, event.getClientAddress));
            rateLimitHeaders = limit.headers;
            if (limit.limited)
                return new Response(
                    JSON.stringify(
                        isArdRequest ?
                            {
                                errorCode: 'RATE_LIMIT_EXCEEDED',
                                message: 'Rate limit exceeded. Please wait before retrying.'
                            }
                        :   {
                                error: {
                                    code: 'RATE_LIMITED',
                                    message: 'Rate limit exceeded. Please wait before retrying.'
                                }
                            }
                    ),
                    {
                        status: 429,
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Cache-Control': 'no-store',
                            'X-Request-ID': requestId,
                            ...(isInternalApi ?
                                {}
                            :   {
                                    'Access-Control-Allow-Origin': '*',
                                    'Access-Control-Expose-Headers': PUBLIC_API_EXPOSED_HEADERS
                                }),
                            ...limit.headers
                        }
                    }
                );
        }

        let response = await resolve(event, {
            transformPageChunk: ({ html }) => {
                const cdn = getCdnBaseUrl();
                return cdn ? html.replaceAll(`${cdn}//`, `${cdn}/`) : html;
            }
        });
        const contentType = response.headers.get('content-type') ?? '';
        const preview =
            publicEnv.PUBLIC_SENTRY_ENVIRONMENT === 'preview'
            || event.url.hostname.endsWith('.pages.dev')
            || event.url.hostname.endsWith('.workers.dev');
        if (contentType.includes('text/html')) {
            response.headers.set(
                'Content-Security-Policy',
                buildContentSecurityPolicy({
                    sentryDsn: publicEnv.PUBLIC_SENTRY_DSN,
                    cdnBaseUrl: publicEnv.PUBLIC_CDN_BASE_URL,
                    apiBaseUrl: apiBaseUrl(publicEnv.PUBLIC_API_BASE_URL),
                    dev
                })
            );
        }
        if (isInternalApi || preview) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
        if (isInternalApi || response.status >= 400)
            response.headers.set('Cache-Control', 'no-store');
        if (isApiRequest && !isInternalApi) {
            response.headers.append('Vary', 'Accept');
            response.headers.set('Access-Control-Expose-Headers', PUBLIC_API_EXPOSED_HEADERS);
        }

        if (isApiRequest) {
            response.headers.set('X-Request-ID', requestId);
            if (!isInternalApi) response.headers.set('Access-Control-Allow-Origin', '*');
            for (const [key, value] of Object.entries(rateLimitHeaders))
                response.headers.set(key, value);
        }

        if (isApiRequest && needsApiEnvelope(response))
            return apiErrorEnvelope(response, {
                requestId,
                ard: isArdRequest,
                publicCors: !isInternalApi,
                allow: isInternalApi ? undefined : publicAllow,
                fallbackAllow: isInternalApi ? 'GET, HEAD, POST' : undefined,
                noindex: isInternalApi || preview,
                headers: rateLimitHeaders
            });

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
            && !contentType.includes('application/octet-stream')
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
    },
    pageDataCache,
    writeFreezeHandle
);

export const handleError = Sentry.handleErrorWithSentry();
