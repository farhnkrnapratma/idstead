import { configuredAdminUrl, configuredSiteUrl } from '../siteUrl';
import { OIDC_ALG } from './keys';

export const OIDC_SCOPES = ['openid', 'profile', 'email', 'offline_access'] as const;

export type OidcScope = (typeof OIDC_SCOPES)[number];

export const OIDC_CLAIMS = [
    'sub',
    'iss',
    'aud',
    'exp',
    'iat',
    'auth_time',
    'nonce',
    'name',
    'preferred_username',
    'picture',
    'website',
    'updated_at',
    'email',
    'email_verified'
] as const;

export interface OidcEndpoints {
    issuer: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
    userinfoEndpoint: string;
    revocationEndpoint: string;
    jwksUri: string;
}

export function oidcEndpoints(platform: unknown): OidcEndpoints {
    const issuer = configuredSiteUrl(platform);
    return {
        issuer,
        authorizationEndpoint: `${configuredAdminUrl(platform)}/oauth/authorize`,
        tokenEndpoint: `${issuer}/oauth/token`,
        userinfoEndpoint: `${issuer}/oauth/userinfo`,
        revocationEndpoint: `${issuer}/oauth/revoke`,
        jwksUri: `${issuer}/.well-known/jwks.json`
    };
}

export function discoveryDocument(endpoints: OidcEndpoints) {
    return {
        issuer: endpoints.issuer,
        authorization_endpoint: endpoints.authorizationEndpoint,
        token_endpoint: endpoints.tokenEndpoint,
        userinfo_endpoint: endpoints.userinfoEndpoint,
        revocation_endpoint: endpoints.revocationEndpoint,
        jwks_uri: endpoints.jwksUri,
        scopes_supported: [...OIDC_SCOPES],
        claims_supported: [...OIDC_CLAIMS],
        response_types_supported: ['code'],
        response_modes_supported: ['query'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: [OIDC_ALG],
        token_endpoint_auth_methods_supported: [
            'client_secret_basic',
            'client_secret_post',
            'none'
        ],
        revocation_endpoint_auth_methods_supported: [
            'client_secret_basic',
            'client_secret_post',
            'none'
        ],
        code_challenge_methods_supported: ['S256'],
        authorization_response_iss_parameter_supported: true,
        claims_parameter_supported: false,
        request_parameter_supported: false,
        request_uri_parameter_supported: false
    };
}
