import type { OidcAuthStore, OidcClientStore } from '@idstead/data';
import { OIDC_SCOPES, type OidcScope } from './config';
import { randomToken, sha256Hex } from './clients';

export const CODE_TTL_MS = 60_000;
export const FRESH_LOGIN_SECONDS = 300;

const SINGLE_PARAMS = [
    'client_id',
    'redirect_uri',
    'response_type',
    'scope',
    'state',
    'nonce',
    'code_challenge',
    'code_challenge_method',
    'prompt',
    'max_age'
];

const CODE_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
const MAX_AGE = /^\d{1,9}$/;
const PROMPTS = new Set(['none', 'login', 'consent', 'select_account']);

export const SCOPE_DETAILS: Record<OidcScope, { label: string; claims: string[] }> = {
    openid: { label: 'Know it is you', claims: ['A stable account ID for this site'] },
    profile: {
        label: 'See your public profile',
        claims: ['Name', 'Username', 'Avatar', 'Website']
    },
    email: { label: 'See your email address', claims: ['Email address'] },
    offline_access: {
        label: 'Stay signed in',
        claims: ['Keeps access for up to 30 days without asking you again']
    }
};

export interface AuthorizeClient {
    clientId: string;
    name: string;
    redirectUris: string[];
}

export interface AuthorizeRequest {
    clientId: string;
    redirectUri: string;
    scopes: OidcScope[];
    state: string | null;
    nonce: string | null;
    codeChallenge: string;
    prompt: string[];
    maxAge: number | null;
}

export type AuthorizeCheck =
    | { kind: 'fatal'; message: string }
    | {
          kind: 'error';
          redirectUri: string;
          state: string | null;
          error: string;
          description: string;
      }
    | { kind: 'ok'; request: AuthorizeRequest };

export function parseScopes(value: string | null): OidcScope[] {
    const requested = new Set((value ?? '').split(' ').filter(Boolean));
    return OIDC_SCOPES.filter(scope => requested.has(scope));
}

export function checkAuthorizeRequest(
    params: URLSearchParams,
    client: AuthorizeClient | null
): AuthorizeCheck {
    const clientId = params.get('client_id');
    if (!clientId) return { kind: 'fatal', message: 'The request names no app (client_id).' };
    if (!client || client.clientId !== clientId)
        return { kind: 'fatal', message: 'This app is not registered on this site.' };
    const redirectUri = params.get('redirect_uri');
    if (!redirectUri || params.getAll('redirect_uri').length > 1)
        return { kind: 'fatal', message: 'The request has no single redirect_uri.' };
    if (!client.redirectUris.includes(redirectUri))
        return {
            kind: 'fatal',
            message: 'The redirect_uri does not match any URI registered for this app.'
        };

    const state = params.get('state');
    const fail = (error: string, description: string): AuthorizeCheck => ({
        kind: 'error',
        redirectUri,
        state: state && state.length <= 1024 ? state : null,
        error,
        description
    });

    if (SINGLE_PARAMS.some(name => params.getAll(name).length > 1))
        return fail('invalid_request', 'A parameter is repeated.');
    if (state && state.length > 1024) return fail('invalid_request', 'state is too long.');
    if (params.has('request'))
        return fail('request_not_supported', 'Request objects are not supported.');
    if (params.has('request_uri'))
        return fail('request_uri_not_supported', 'request_uri is not supported.');
    if (params.get('response_type') !== 'code')
        return fail('unsupported_response_type', 'Only response_type=code is supported.');

    const scopes = parseScopes(params.get('scope'));
    if (!scopes.includes('openid')) return fail('invalid_scope', 'The openid scope is required.');

    if (params.get('code_challenge_method') !== 'S256')
        return fail('invalid_request', 'PKCE with code_challenge_method=S256 is required.');
    const codeChallenge = params.get('code_challenge') ?? '';
    if (!CODE_CHALLENGE.test(codeChallenge))
        return fail('invalid_request', 'code_challenge must be a base64url SHA-256 digest.');

    const nonce = params.get('nonce');
    if (nonce !== null && (nonce.length === 0 || nonce.length > 255))
        return fail('invalid_request', 'nonce must be 1 to 255 characters.');

    const prompt = (params.get('prompt') ?? '').split(' ').filter(Boolean);
    if (prompt.some(value => !PROMPTS.has(value)))
        return fail('invalid_request', 'prompt has an unknown value.');
    if (prompt.includes('none') && prompt.length > 1)
        return fail('invalid_request', 'prompt=none cannot be combined with other values.');

    const maxAgeParam = params.get('max_age');
    if (maxAgeParam !== null && !MAX_AGE.test(maxAgeParam))
        return fail('invalid_request', 'max_age must be a whole number of seconds.');
    const maxAge = maxAgeParam === null ? null : Number(maxAgeParam);

    return {
        kind: 'ok',
        request: { clientId, redirectUri, scopes, state, nonce, codeChallenge, prompt, maxAge }
    };
}

export function authorizationRedirect(
    redirectUri: string,
    values: Record<string, string | null | undefined>
): string {
    const url = new URL(redirectUri);
    for (const [key, value] of Object.entries(values))
        if (value !== null && value !== undefined) url.searchParams.set(key, value);
    return url.toString();
}

export function errorRedirect(
    check: Extract<AuthorizeCheck, { kind: 'error' }>,
    issuer: string
): string {
    return authorizationRedirect(check.redirectUri, {
        error: check.error,
        error_description: check.description,
        state: check.state,
        iss: issuer
    });
}

export function scopesCovered(granted: string[], requested: string[]): boolean {
    return requested.every(scope => granted.includes(scope));
}

export async function issueAuthorizationCode(
    store: OidcAuthStore,
    request: AuthorizeRequest,
    grantId: string,
    authTime: number,
    now = Date.now()
): Promise<string> {
    const code = randomToken(32);
    await store.issueCode({
        codeHash: await sha256Hex(code),
        grantId,
        redirectUri: request.redirectUri,
        scopes: request.scopes,
        nonce: request.nonce,
        codeChallenge: request.codeChallenge,
        authTime,
        expiresAt: new Date(now + CODE_TTL_MS).toISOString()
    });
    return code;
}

export function successRedirect(request: AuthorizeRequest, code: string, issuer: string): string {
    return authorizationRedirect(request.redirectUri, { code, state: request.state, iss: issuer });
}

export interface ConsentScope {
    scope: OidcScope;
    label: string;
    claims: string[];
}

export type AuthorizationOutcome =
    | { kind: 'fatal'; message: string }
    | { kind: 'login' }
    | { kind: 'redirect'; url: string; consented: { clientId: string; name: string } | null }
    | { kind: 'consent'; client: { name: string; host: string }; scopes: ConsentScope[] };

export async function resolveAuthorization(
    stores: { clients: OidcClientStore; auth: OidcAuthStore },
    params: URLSearchParams,
    options: { issuer: string; authTime: number | null; decision?: 'allow' | 'deny'; now?: number }
): Promise<AuthorizationOutcome> {
    const clientId = params.get('client_id');
    const client = clientId ? await stores.clients.get(clientId) : null;
    const check = checkAuthorizeRequest(params, client);
    if (check.kind === 'fatal') return check;
    if (check.kind === 'error')
        return { kind: 'redirect', url: errorRedirect(check, options.issuer), consented: null };
    const { request } = check;
    const deny = (error: string, description: string): AuthorizationOutcome => ({
        kind: 'redirect',
        url: errorRedirect(
            {
                kind: 'error',
                redirectUri: request.redirectUri,
                state: request.state,
                error,
                description
            },
            options.issuer
        ),
        consented: null
    });

    if (options.authTime === null)
        return request.prompt.includes('none') ?
                deny('login_required', 'The owner is not signed in.')
            :   { kind: 'login' };
    const authTime = options.authTime;
    if (options.decision === 'deny')
        return deny('access_denied', 'The owner declined the request.');
    const nowSeconds = Math.floor((options.now ?? Date.now()) / 1000);
    const maxAge = request.prompt.includes('login') ? FRESH_LOGIN_SECONDS : request.maxAge;
    if (maxAge !== null && nowSeconds - authTime > maxAge)
        return deny('login_required', 'Sign out of the admin and sign in again, then retry.');

    const existing = await stores.auth.activeGrant(request.clientId);
    const covered =
        existing !== null
        && scopesCovered(existing.scopes, request.scopes)
        && !request.prompt.includes('consent');

    if (!covered && options.decision !== 'allow') {
        if (request.prompt.includes('none'))
            return deny('consent_required', 'The owner has not approved this app yet.');
        return {
            kind: 'consent',
            client: { name: client!.name, host: new URL(request.redirectUri).host },
            scopes: request.scopes.map(scope => ({ scope, ...SCOPE_DETAILS[scope] }))
        };
    }

    const grant =
        covered && existing ? existing : await stores.auth.grant(request.clientId, request.scopes);
    const code = await issueAuthorizationCode(stores.auth, request, grant.id, authTime);
    return {
        kind: 'redirect',
        url: successRedirect(request, code, options.issuer),
        consented: covered ? null : { clientId: request.clientId, name: client!.name }
    };
}
