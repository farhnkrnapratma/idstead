CREATE TABLE db_oidc_subject (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    subject TEXT NOT NULL DEFAULT (lower(hex(randomblob(16)))) CHECK (length(subject) = 32 AND subject NOT GLOB '*[^0-9a-f]*')
);

INSERT INTO db_oidc_subject (id) VALUES (1);

CREATE TABLE db_oidc_clients (
    id INTEGER PRIMARY KEY,
    client_id TEXT NOT NULL UNIQUE CHECK (length(client_id) BETWEEN 16 AND 64 AND client_id NOT GLOB '*[^0-9A-Za-z_-]*'),
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
    redirect_uris TEXT NOT NULL CHECK (
        json_valid(redirect_uris)
        AND json_type(redirect_uris) = 'array'
        AND json_array_length(redirect_uris) BETWEEN 1 AND 10
    ),
    secret_hash TEXT CHECK (secret_hash IS NULL OR (length(secret_hash) = 64 AND secret_hash NOT GLOB '*[^0-9a-f]*')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE db_oidc_grants (
    id INTEGER PRIMARY KEY,
    public_id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))),
    client_id TEXT NOT NULL REFERENCES db_oidc_clients (client_id) ON DELETE CASCADE,
    scopes TEXT NOT NULL CHECK (json_valid(scopes) AND json_type(scopes) = 'array'),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_used_at TEXT,
    revoked_at TEXT
);

CREATE UNIQUE INDEX db_oidc_grants_active_idx ON db_oidc_grants (client_id) WHERE revoked_at IS NULL;

CREATE TABLE db_oidc_codes (
    code_hash TEXT PRIMARY KEY CHECK (length(code_hash) = 64 AND code_hash NOT GLOB '*[^0-9a-f]*'),
    grant_id INTEGER NOT NULL REFERENCES db_oidc_grants (id) ON DELETE CASCADE,
    redirect_uri TEXT NOT NULL,
    scopes TEXT NOT NULL CHECK (json_valid(scopes) AND json_type(scopes) = 'array'),
    nonce TEXT CHECK (nonce IS NULL OR length(nonce) <= 255),
    code_challenge TEXT NOT NULL CHECK (length(code_challenge) = 43),
    auth_time INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT
);

CREATE INDEX db_oidc_codes_expires_at_idx ON db_oidc_codes (expires_at);

CREATE TABLE db_oidc_refresh_tokens (
    token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
    grant_id INTEGER NOT NULL REFERENCES db_oidc_grants (id) ON DELETE CASCADE,
    scopes TEXT NOT NULL CHECK (json_valid(scopes) AND json_type(scopes) = 'array'),
    auth_time INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    expires_at TEXT NOT NULL,
    rotated_at TEXT,
    revoked_at TEXT
);

CREATE INDEX db_oidc_refresh_tokens_grant_idx ON db_oidc_refresh_tokens (grant_id);
CREATE INDEX db_oidc_refresh_tokens_expires_at_idx ON db_oidc_refresh_tokens (expires_at);
