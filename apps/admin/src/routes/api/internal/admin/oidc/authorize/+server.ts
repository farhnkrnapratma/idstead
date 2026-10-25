import type { RequestHandler } from './$types';
import { apiError } from '#lib/server/apiError.ts';
import { oidcAdmin } from '#lib/server/oidc/admin.ts';
import { logActivity } from '#lib/server/activityLog.ts';
import { ipSalt } from '#lib/server/ipSalt.ts';
import { oidcEnabled } from '#lib/server/oidc/enabled.ts';
import { oidcEndpoints } from '#lib/server/oidc/config.ts';
import { resolveAuthorization } from '#lib/server/oidc/authorize.ts';

const NO_STORE = { 'Cache-Control': 'no-store' };

export const POST: RequestHandler = async ({
    request,
    url,
    platform,
    locals,
    getClientAddress
}) => {
    const auth = await oidcAdmin(request, url, platform);
    if (!auth.ok) return auth.response;
    const { service } = auth;
    if (!oidcEnabled(platform))
        return apiError(503, 'OIDC_UNAVAILABLE', 'Sign in with Idstead is not set up.');

    let body: { query?: unknown; decision?: unknown };
    try {
        body = await request.json();
    } catch {
        return apiError(400, 'OIDC_AUTHORIZE_INVALID_INPUT', 'Invalid JSON body.');
    }
    if (
        typeof body.query !== 'string'
        || !body.query.startsWith('?')
        || (body.decision !== 'allow' && body.decision !== 'deny')
    )
        return apiError(400, 'OIDC_AUTHORIZE_INVALID_INPUT', 'Invalid authorization decision.');

    const session = await locals.getAdminSession();
    if (!session || session.role !== 'admin' || !session.mfaSatisfied)
        return apiError(401, 'ADMIN_AUTH_REQUIRED', 'Your session has expired. Log in again.');
    try {
        const outcome = await resolveAuthorization(
            { clients: service.oidcClients, auth: service.oidcAuth },
            new URLSearchParams(body.query),
            {
                issuer: oidcEndpoints(platform).issuer,
                authTime: session.authTime,
                decision: body.decision
            }
        );
        if (outcome.kind === 'fatal')
            return apiError(400, 'OIDC_AUTHORIZE_INVALID_REQUEST', outcome.message);
        if (outcome.kind !== 'redirect')
            return apiError(400, 'OIDC_AUTHORIZE_INVALID_REQUEST', 'No decision was made.');
        if (outcome.consented)
            await logActivity(
                {
                    actor: auth.actor,
                    action: 'oidc.consent',
                    category: 'security',
                    entityId: outcome.consented.clientId,
                    summary: `Allowed ${outcome.consented.name} to sign in with this identity.`,
                    ip: (() => {
                        try {
                            return getClientAddress();
                        } catch {
                            return null;
                        }
                    })(),
                    ipSalt: ipSalt(platform),
                    userAgent: request.headers.get('user-agent')
                },
                service.activityLog
            );
        return Response.json({ redirect: outcome.url }, { headers: NO_STORE });
    } catch (error) {
        console.error('OIDC consent failed:', error);
        return apiError(503, 'OIDC_UNAVAILABLE', 'The decision could not be saved.');
    }
};
