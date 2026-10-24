import type { RequestHandler } from './$types';
import { apiError } from '#lib/server/apiError.ts';
import { blogAdmin } from '#lib/server/blogPostAuth.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { dataStores } from '#lib/server/data.ts';
import { logActivity } from '#lib/server/activityLog.ts';
import { ipSalt } from '#lib/server/ipSalt.ts';
import { oidcSigningKey } from '#lib/server/oidc/keys.ts';
import { oidcEndpoints } from '#lib/server/oidc/config.ts';
import {
    generateClientId,
    generateClientSecret,
    parseClientInput,
    sha256Hex
} from '#lib/server/oidc/clients.ts';

const NO_STORE = { 'Cache-Control': 'no-store' };

function clientIp(getClientAddress: () => string) {
    try {
        return getClientAddress();
    } catch {
        return null;
    }
}

async function authorize(request: Request, url: URL, platform: App.Platform | undefined) {
    const db = getSupabaseAdminClient(platform);
    if (!db)
        return {
            ok: false as const,
            response: apiError(503, 'OIDC_UNAVAILABLE', 'Admin auth is unavailable.')
        };
    const auth = await blogAdmin(request, url, db);
    if (auth.status)
        return {
            ok: false as const,
            response: apiError(
                auth.status,
                auth.code ?? (auth.status === 401 ? 'ADMIN_AUTH_REQUIRED' : 'ADMIN_FORBIDDEN'),
                auth.message
            )
        };
    const { service } = dataStores(platform);
    if (!service)
        return {
            ok: false as const,
            response: apiError(503, 'OIDC_UNAVAILABLE', 'Database is unavailable.')
        };
    return { ok: true as const, actor: auth.actor, service };
}

export const GET: RequestHandler = async ({ request, url, platform }) => {
    const auth = await authorize(request, url, platform);
    if (!auth.ok) return auth.response;
    try {
        const [clients, key] = await Promise.all([
            auth.service.oidcClients.list(),
            oidcSigningKey(platform)
        ]);
        const { issuer } = oidcEndpoints(platform);
        return Response.json(
            {
                enabled: Boolean(key),
                issuer,
                discoveryUrl: `${issuer}/.well-known/openid-configuration`,
                clients
            },
            { headers: NO_STORE }
        );
    } catch (error) {
        console.error('OIDC client list failed:', error);
        return apiError(503, 'OIDC_UNAVAILABLE', 'Database is unavailable.');
    }
};

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    const auth = await authorize(request, url, platform);
    if (!auth.ok) return auth.response;
    const { service, actor } = auth;

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return apiError(400, 'OIDC_CLIENT_INVALID_INPUT', 'Invalid JSON body.');
    }

    const log = (action: string, clientId: string, summary: string) =>
        logActivity(
            {
                actor,
                action,
                category: 'security',
                entityId: clientId,
                summary,
                ip: clientIp(getClientAddress),
                ipSalt: ipSalt(platform),
                userAgent: request.headers.get('user-agent')
            },
            service.activityLog
        );

    const clientId = typeof body.clientId === 'string' ? body.clientId : '';

    try {
        switch (body.action) {
            case 'create': {
                const input = parseClientInput(body.name, body.redirectUris);
                if (!input.ok) return apiError(400, 'OIDC_CLIENT_INVALID_INPUT', input.message);
                const secret = body.confidential === false ? null : generateClientSecret();
                const client = await service.oidcClients.create({
                    clientId: generateClientId(),
                    name: input.name,
                    redirectUris: input.redirectUris,
                    secretHash: secret ? await sha256Hex(secret) : null
                });
                await log('oidc.client.create', client.clientId, `Registered app ${client.name}.`);
                return Response.json(
                    { client, clientSecret: secret },
                    { status: 201, headers: NO_STORE }
                );
            }
            case 'update': {
                const input = parseClientInput(body.name, body.redirectUris);
                if (!input.ok) return apiError(400, 'OIDC_CLIENT_INVALID_INPUT', input.message);
                const client = await service.oidcClients.update(clientId, {
                    name: input.name,
                    redirectUris: input.redirectUris
                });
                if (!client) return apiError(404, 'OIDC_CLIENT_NOT_FOUND', 'App not found.');
                await log('oidc.client.update', client.clientId, `Updated app ${client.name}.`);
                return Response.json({ client }, { headers: NO_STORE });
            }
            case 'rotate': {
                const secret = generateClientSecret();
                if (!(await service.oidcClients.setSecretHash(clientId, await sha256Hex(secret))))
                    return apiError(
                        404,
                        'OIDC_CLIENT_NOT_FOUND',
                        'App not found, or it is a public app without a secret.'
                    );
                await log('oidc.client.rotate', clientId, 'Rotated an app secret.');
                return Response.json({ clientSecret: secret }, { headers: NO_STORE });
            }
            case 'delete': {
                if (!(await service.oidcClients.delete(clientId)))
                    return apiError(404, 'OIDC_CLIENT_NOT_FOUND', 'App not found.');
                await log('oidc.client.delete', clientId, 'Deleted an app and its access.');
                return Response.json({ success: true }, { headers: NO_STORE });
            }
            default:
                return apiError(400, 'OIDC_CLIENT_INVALID_INPUT', 'Unknown action.');
        }
    } catch (error) {
        console.error('OIDC client change failed:', error);
        return apiError(503, 'OIDC_UNAVAILABLE', 'Database is unavailable.');
    }
};
