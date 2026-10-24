import { checkRateLimit, clientIp } from '../rateLimit';
import { OAUTH_CORS_HEADERS, type OidcEndpointDeps } from './endpoints';
import { oidcEndpointDeps } from './deps';

export function oauthPreflight() {
    return new Response(null, { status: 204, headers: OAUTH_CORS_HEADERS });
}

export async function oauthRoute(
    event: { request: Request; platform: unknown; getClientAddress: () => string },
    handler: (request: Request, deps: OidcEndpointDeps) => Promise<Response>
): Promise<Response> {
    const limit = await checkRateLimit(`oauth:${clientIp(event.request, event.getClientAddress)}`);
    if (limit.limited)
        return Response.json(
            { error: 'slow_down', error_description: 'Rate limit exceeded.' },
            {
                status: 429,
                headers: {
                    ...limit.headers,
                    'Cache-Control': 'no-store',
                    'Access-Control-Allow-Origin': '*'
                }
            }
        );
    const deps = await oidcEndpointDeps(event.platform, event.request, event.getClientAddress);
    if (!deps)
        return Response.json(
            { error: 'temporarily_unavailable', error_description: 'Sign-in is not set up.' },
            {
                status: 404,
                headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }
            }
        );
    try {
        return await handler(event.request, deps);
    } catch (error) {
        console.error('OAuth endpoint failed:', error);
        return Response.json(
            { error: 'server_error', error_description: 'The request could not be processed.' },
            {
                status: 500,
                headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }
            }
        );
    }
}
