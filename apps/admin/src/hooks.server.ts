import { sequence } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import type { Handle } from '@sveltejs/kit/hooks';
import { writeFreezeHandle } from '#lib/server/writeFreeze.ts';
import * as publicEnv from '$app/env/public';
import { dev } from '$app/env';
import { assetNames, serveIdentityAsset } from '#lib/server/profileAssets.ts';
import { accessIdentity, type AccessIdentity } from '#lib/server/accessAuth.ts';
import { privateRequestIntegrations } from '#lib/server/sentryPrivacy.ts';
import { buildContentSecurityPolicy } from '#lib/server/csp.ts';
import { apiErrorEnvelope, needsApiEnvelope } from '#lib/server/apiEnvelope.ts';

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

const PUBLIC_PATHS = new Set(['/robots.txt']);

function isIdentityAsset(pathname: string) {
    return assetNames.includes(pathname.slice(1)) || pathname === '/hero.png';
}

const authHandle: Handle = async ({ event, resolve }) => {
    let identity: Promise<AccessIdentity | null> | null = null;
    event.locals.getAdmin = () => (identity ??= accessIdentity(event.request, event.platform));

    const path = event.url.pathname;
    const guarded =
        !PUBLIC_PATHS.has(path)
        && !path.startsWith('/api/')
        && !path.startsWith('/_app/')
        && !isIdentityAsset(path);
    if (guarded && !(await event.locals.getAdmin()))
        return new Response('Sign in through Cloudflare Access to open the admin.', {
            status: 401,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-store',
                'X-Robots-Tag': 'noindex, nofollow'
            }
        });

    return resolve(event, { filterSerializedResponseHeaders: name => name === 'content-range' });
};

const responseHandle: Handle = async ({ event, resolve }) => {
    const requestId = event.request.headers.get('x-request-id') || crypto.randomUUID();
    const path = event.url.pathname;

    if (isIdentityAsset(path)) {
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

    const isApiRequest = path.startsWith('/api/');

    if (isApiRequest && event.request.method === 'OPTIONS') {
        const origin = event.request.headers.get('origin');
        if (origin && origin !== event.url.origin)
            return new Response(null, { status: 403, headers: { 'Cache-Control': 'no-store' } });
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400',
                'X-Request-ID': requestId
            }
        });
    }

    const response = await resolve(event);
    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('text/html'))
        response.headers.set(
            'Content-Security-Policy',
            buildContentSecurityPolicy({
                sentryDsn: publicEnv.PUBLIC_SENTRY_DSN,
                cdnBaseUrl: publicEnv.PUBLIC_CDN_BASE_URL,
                dev
            })
        );
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('Cache-Control', 'no-store');

    if (isApiRequest) {
        response.headers.set('X-Request-ID', requestId);
        if (needsApiEnvelope(response))
            return apiErrorEnvelope(response, {
                requestId,
                fallbackAllow: 'GET, HEAD, POST',
                noindex: true
            });
    }

    if (event.request.method === 'HEAD' && response.body)
        return new Response(null, { status: response.status, headers: response.headers });
    return response;
};

export const handle: Handle = sequence(
    sentryInitHandle,
    Sentry.sentryHandle(),
    authHandle,
    responseHandle,
    writeFreezeHandle
);

export const handleError = Sentry.handleErrorWithSentry();
