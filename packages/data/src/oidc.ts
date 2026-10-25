export interface OidcClient {
    clientId: string;
    name: string;
    redirectUris: string[];
    confidential: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface OidcClientRecord extends OidcClient {
    secretHash: string | null;
}

export interface OidcClientInput {
    clientId: string;
    name: string;
    redirectUris: string[];
    secretHash: string | null;
}

export interface OidcClientStore {
    list(): Promise<OidcClient[]>;
    get(clientId: string): Promise<OidcClientRecord | null>;
    create(input: OidcClientInput): Promise<OidcClient>;
    update(
        clientId: string,
        changes: { name: string; redirectUris: string[] }
    ): Promise<OidcClient | null>;
    setSecretHash(clientId: string, secretHash: string): Promise<boolean>;
    delete(clientId: string): Promise<boolean>;
}

export interface OidcGrant {
    id: string;
    clientId: string;
    clientName: string;
    scopes: string[];
    createdAt: string;
    lastUsedAt: string | null;
}

export interface OidcCodeInput {
    codeHash: string;
    grantId: string;
    redirectUri: string;
    scopes: string[];
    nonce: string | null;
    codeChallenge: string;
    authTime: number;
    expiresAt: string;
}

export interface OidcCodeRecord {
    grantId: string;
    clientId: string;
    redirectUri: string;
    scopes: string[];
    nonce: string | null;
    codeChallenge: string;
    authTime: number;
}

export type OidcCodeResult =
    { status: 'ok'; code: OidcCodeRecord } | { status: 'reused' } | { status: 'invalid' };

export interface OidcRefreshInput {
    tokenHash: string;
    grantId: string;
    scopes: string[];
    authTime: number;
    expiresAt: string;
}

export interface OidcRefreshRecord {
    grantId: string;
    clientId: string;
    scopes: string[];
    authTime: number;
}

export type OidcRefreshResult =
    | { status: 'rotated'; token: OidcRefreshRecord }
    | { status: 'reused' }
    | { status: 'invalid' }
    | { status: 'invalid_scope' };

export interface OidcAuthStore {
    subject(): Promise<string>;
    activeGrant(clientId: string): Promise<OidcGrant | null>;
    grant(clientId: string, scopes: string[]): Promise<OidcGrant>;
    listGrants(): Promise<OidcGrant[]>;
    revokeGrant(grantId: string): Promise<boolean>;
    issueCode(input: OidcCodeInput): Promise<void>;
    consumeCode(codeHash: string): Promise<OidcCodeResult>;
    issueRefresh(input: OidcRefreshInput): Promise<void>;
    rotateRefresh(
        tokenHash: string,
        clientId: string,
        next: { tokenHash: string; scopes: string[] | null }
    ): Promise<OidcRefreshResult>;
    revokeGrantByRefresh(tokenHash: string, clientId: string): Promise<boolean>;
    prune(): Promise<void>;
}
