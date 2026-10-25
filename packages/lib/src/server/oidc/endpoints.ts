import type { OidcAuthStore, OidcClientRecord, OidcClientStore } from '@idstead/data';
import type { OidcSigningKey } from './keys';
import { parseScopes } from './authorize';
import { randomToken, sha256Hex } from './clients';
import {
    ACCESS_TOKEN_TTL_SECONDS,
    REFRESH_TOKEN_TTL_MS,
    profileClaims,
    signAccessToken,
    signIdToken,
    verifyAccessToken,
    type ClaimsProfile
} from './tokens';

export interface ClientLockout {
    retryAfter(keys: string[]): Promise<number>;
    fail(keys: string[]): Promise<void>;
}

export interface OidcEndpointDeps {
    clients: OidcClientStore;
    auth: OidcAuthStore;
    key: OidcSigningKey;
    issuer: string;
    profile: () => Promise<ClaimsProfile | null>;
    lockout: ClientLockout;
    ip: string;
    now?: () => number;
}

export const OAUTH_CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400'
};

const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;

function oauthJson(body: unknown, status = 200, headers: Record<string, string> = {}) {
    return Response.json(body, {
        status,
        headers: {
            'Cache-Control': 'no-store',
            Pragma: 'no-cache',
            'Access-Control-Allow-Origin': '*',
            ...headers
        }
    });
}

function oauthError(
    status: number,
    error: string,
    description: string,
    headers: Record<string, string> = {}
) {
    return oauthJson({ error, error_description: description }, status, headers);
}

function constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let index = 0; index < a.length; index++)
        diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
    return diff === 0;
}

function base64Url(bytes: ArrayBuffer): string {
    let binary = '';
    for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function pkceChallenge(verifier: string): Promise<string> {
    return base64Url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
}

async function readForm(request: Request): Promise<URLSearchParams | null> {
    const type = request.headers.get('content-type') ?? '';
    if (!type.toLowerCase().startsWith('application/x-www-form-urlencoded')) return null;
    try {
        return new URLSearchParams(await request.text());
    } catch {
        return null;
    }
}

function basicCredentials(request: Request): { id: string; secret: string } | null | 'invalid' {
    const header = request.headers.get('authorization');
    if (!header) return null;
    const match = /^Basic\s+([A-Za-z0-9+/=]+)$/i.exec(header.trim());
    if (!match) return 'invalid';
    try {
        const decoded = atob(match[1]);
        const separator = decoded.indexOf(':');
        if (separator < 0) return 'invalid';
        return {
            id: decodeURIComponent(decoded.slice(0, separator).replace(/\+/g, ' ')),
            secret: decodeURIComponent(decoded.slice(separator + 1).replace(/\+/g, ' '))
        };
    } catch {
        return 'invalid';
    }
}

type ClientAuth = { ok: true; client: OidcClientRecord } | { ok: false; response: Response };

async function authenticateClient(
    request: Request,
    form: URLSearchParams,
    deps: OidcEndpointDeps
): Promise<ClientAuth> {
    const basic = basicCredentials(request);
    const invalidClient = (usedBasic: boolean) => ({
        ok: false as const,
        response: oauthError(
            401,
            'invalid_client',
            'Client authentication failed.',
            usedBasic ? { 'WWW-Authenticate': 'Basic realm="idstead"' } : {}
        )
    });
    if (basic === 'invalid') return invalidClient(true);
    if (
        basic
        && (form.has('client_secret')
            || (form.has('client_id') && form.get('client_id') !== basic.id))
    )
        return {
            ok: false,
            response: oauthError(400, 'invalid_request', 'Use one client authentication method.')
        };

    const clientId = basic?.id ?? form.get('client_id') ?? '';
    const secret = basic?.secret ?? form.get('client_secret');
    if (!clientId) return invalidClient(Boolean(basic));

    const keys = [`oidc-client:${clientId}:${deps.ip}`, `oidc-ip:${deps.ip}`];
    const wait = await deps.lockout.retryAfter(keys);
    if (wait > 0)
        return {
            ok: false,
            response: oauthError(429, 'slow_down', 'Too many failed attempts.', {
                'Retry-After': String(wait)
            })
        };

    const client = await deps.clients.get(clientId);
    const valid =
        client !== null
        && (client.secretHash === null ?
            secret === null
        :   secret !== null && constantTimeEqual(await sha256Hex(secret), client.secretHash));
    if (!valid) {
        await deps.lockout.fail(keys);
        return invalidClient(Boolean(basic));
    }
    return { ok: true, client };
}

async function tokenResponse(
    deps: OidcEndpointDeps,
    input: {
        client: OidcClientRecord;
        grantId: string;
        scopes: string[];
        authTime: number;
        nonce: string | null;
        refreshToken: string | null;
    }
) {
    const now = Math.floor((deps.now?.() ?? Date.now()) / 1000);
    const subject = await deps.auth.subject();
    const claims = profileClaims(await deps.profile(), input.scopes, deps.issuer);
    const token = {
        issuer: deps.issuer,
        subject,
        clientId: input.client.clientId,
        grantId: input.grantId,
        scopes: input.scopes,
        authTime: input.authTime,
        nonce: input.nonce,
        claims
    };
    return oauthJson({
        access_token: await signAccessToken(deps.key, token, now),
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        scope: input.scopes.join(' '),
        id_token: await signIdToken(deps.key, token, now),
        ...(input.refreshToken ? { refresh_token: input.refreshToken } : {})
    });
}

export async function handleTokenRequest(request: Request, deps: OidcEndpointDeps) {
    const form = await readForm(request);
    if (!form) return oauthError(400, 'invalid_request', 'Send the request as a URL-encoded form.');
    const auth = await authenticateClient(request, form, deps);
    if (!auth.ok) return auth.response;
    const { client } = auth;
    const nowMs = deps.now?.() ?? Date.now();

    const grantType = form.get('grant_type');
    if (grantType === 'authorization_code') {
        const code = form.get('code');
        const redirectUri = form.get('redirect_uri');
        const verifier = form.get('code_verifier');
        if (!code || !redirectUri || !verifier)
            return oauthError(
                400,
                'invalid_request',
                'code, redirect_uri and code_verifier are required.'
            );
        if (!VERIFIER.test(verifier))
            return oauthError(400, 'invalid_grant', 'The code_verifier is malformed.');
        const result = await deps.auth.consumeCode(await sha256Hex(code));
        if (result.status !== 'ok')
            return oauthError(400, 'invalid_grant', 'The code is invalid, expired or used.');
        const stored = result.code;
        if (
            stored.clientId !== client.clientId
            || stored.redirectUri !== redirectUri
            || (await pkceChallenge(verifier)) !== stored.codeChallenge
        ) {
            await deps.auth.revokeGrant(stored.grantId);
            return oauthError(400, 'invalid_grant', 'The code does not match this request.');
        }
        let refreshToken: string | null = null;
        if (stored.scopes.includes('offline_access')) {
            refreshToken = randomToken(32);
            await deps.auth.issueRefresh({
                tokenHash: await sha256Hex(refreshToken),
                grantId: stored.grantId,
                scopes: stored.scopes,
                authTime: stored.authTime,
                expiresAt: new Date(nowMs + REFRESH_TOKEN_TTL_MS).toISOString()
            });
        }
        return tokenResponse(deps, {
            client,
            grantId: stored.grantId,
            scopes: stored.scopes,
            authTime: stored.authTime,
            nonce: stored.nonce,
            refreshToken
        });
    }

    if (grantType === 'refresh_token') {
        const presented = form.get('refresh_token');
        if (!presented) return oauthError(400, 'invalid_request', 'refresh_token is required.');
        const requested = form.get('scope');
        const narrowed = requested === null ? null : parseScopes(requested);
        if (narrowed && !narrowed.includes('openid'))
            return oauthError(400, 'invalid_scope', 'The scope must include openid.');
        const next = randomToken(32);
        const rotated = await deps.auth.rotateRefresh(await sha256Hex(presented), client.clientId, {
            tokenHash: await sha256Hex(next),
            scopes: narrowed
        });
        if (rotated.status === 'invalid_scope')
            return oauthError(400, 'invalid_scope', 'The scope must be a subset of the grant.');
        if (rotated.status !== 'rotated')
            return oauthError(400, 'invalid_grant', 'The refresh token is invalid or was revoked.');
        const scopes = narrowed ?? rotated.token.scopes;
        return tokenResponse(deps, {
            client,
            grantId: rotated.token.grantId,
            scopes,
            authTime: rotated.token.authTime,
            nonce: null,
            refreshToken: next
        });
    }

    return oauthError(400, 'unsupported_grant_type', 'Use authorization_code or refresh_token.');
}

function bearerError(error: string, description: string, status = 401) {
    return oauthJson({ error, error_description: description }, status, {
        'WWW-Authenticate': `Bearer error="${error}", error_description="${description}"`
    });
}

export async function handleUserinfo(request: Request, deps: OidcEndpointDeps) {
    const match = /^Bearer\s+([A-Za-z0-9._~+/=-]+)$/i.exec(
        request.headers.get('authorization')?.trim() ?? ''
    );
    if (!match) return oauthJson({}, 401, { 'WWW-Authenticate': 'Bearer realm="idstead"' });
    const claims = await verifyAccessToken(deps.key, match[1], deps.issuer);
    if (!claims) return bearerError('invalid_token', 'The access token is invalid or expired.');
    const grant = await deps.auth.activeGrant(claims.clientId);
    if (!grant || grant.id !== claims.grantId)
        return bearerError('invalid_token', 'Access was revoked.');
    if (claims.subject !== (await deps.auth.subject()))
        return bearerError('invalid_token', 'The access token is invalid or expired.');
    return oauthJson({
        sub: claims.subject,
        ...profileClaims(await deps.profile(), claims.scopes, deps.issuer)
    });
}

export async function handleRevoke(request: Request, deps: OidcEndpointDeps) {
    const form = await readForm(request);
    if (!form) return oauthError(400, 'invalid_request', 'Send the request as a URL-encoded form.');
    const auth = await authenticateClient(request, form, deps);
    if (!auth.ok) return auth.response;
    const token = form.get('token');
    if (!token) return oauthError(400, 'invalid_request', 'token is required.');
    const access = await verifyAccessToken(deps.key, token, deps.issuer);
    if (access) {
        if (access.clientId === auth.client.clientId) await deps.auth.revokeGrant(access.grantId);
    } else await deps.auth.revokeGrantByRefresh(await sha256Hex(token), auth.client.clientId);
    return new Response(null, {
        status: 200,
        headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }
    });
}
