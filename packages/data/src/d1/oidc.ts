// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { DataError } from '../errors';
import type {
    OidcAuthStore,
    OidcClient,
    OidcClientRecord,
    OidcClientStore,
    OidcGrant
} from '../oidc';
import { jsonStrings, type D1Like, type D1Row } from './client';

const CODE_RETENTION_MS = 24 * 60 * 60 * 1000;

function iso(time: number): string {
    return new Date(time).toISOString();
}

function clientRecord(row: D1Row): OidcClientRecord {
    const secretHash = typeof row.secret_hash === 'string' ? row.secret_hash : null;
    return {
        clientId: String(row.client_id),
        name: String(row.name),
        redirectUris: jsonStrings(row.redirect_uris),
        confidential: secretHash !== null,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
        secretHash
    };
}

function publicClient(row: D1Row): OidcClient {
    const { secretHash: _secretHash, ...client } = clientRecord(row);
    return client;
}

function grantRow(row: D1Row): OidcGrant {
    return {
        id: String(row.public_id),
        clientId: String(row.client_id),
        clientName: String(row.client_name),
        scopes: jsonStrings(row.scopes),
        createdAt: String(row.created_at),
        lastUsedAt: typeof row.last_used_at === 'string' ? row.last_used_at : null
    };
}

const CLIENT_COLUMNS = 'client_id, name, redirect_uris, secret_hash, created_at, updated_at';

const GRANT_SELECT = `SELECT g.public_id, g.client_id, c.name AS client_name, g.scopes, g.created_at, g.last_used_at
     FROM db_oidc_grants g JOIN db_oidc_clients c ON c.client_id = g.client_id`;

export function createD1OidcClientStore(db: D1Like, now: () => number = Date.now): OidcClientStore {
    return {
        async list() {
            try {
                const { results } = await db
                    .prepare(
                        `SELECT ${CLIENT_COLUMNS} FROM db_oidc_clients ORDER BY created_at, id`
                    )
                    .all();
                return results.map(publicClient);
            } catch (error) {
                throw new DataError('oidc.clients.list', error);
            }
        },

        async get(clientId) {
            try {
                const row = await db
                    .prepare(`SELECT ${CLIENT_COLUMNS} FROM db_oidc_clients WHERE client_id = ?1`)
                    .bind(clientId)
                    .first();
                return row ? clientRecord(row) : null;
            } catch (error) {
                throw new DataError('oidc.clients.get', error);
            }
        },

        async create(input) {
            try {
                const row = await db
                    .prepare(
                        `INSERT INTO db_oidc_clients (client_id, name, redirect_uris, secret_hash)
                         VALUES (?1, ?2, ?3, ?4) RETURNING ${CLIENT_COLUMNS}`
                    )
                    .bind(
                        input.clientId,
                        input.name.trim(),
                        JSON.stringify(input.redirectUris),
                        input.secretHash
                    )
                    .first();
                if (!row) throw new Error('The client was not created.');
                return publicClient(row);
            } catch (error) {
                throw new DataError('oidc.clients.create', error);
            }
        },

        async update(clientId, changes) {
            try {
                const row = await db
                    .prepare(
                        `UPDATE db_oidc_clients SET name = ?2, redirect_uris = ?3, updated_at = ?4
                         WHERE client_id = ?1 RETURNING ${CLIENT_COLUMNS}`
                    )
                    .bind(
                        clientId,
                        changes.name.trim(),
                        JSON.stringify(changes.redirectUris),
                        iso(now())
                    )
                    .first();
                return row ? publicClient(row) : null;
            } catch (error) {
                throw new DataError('oidc.clients.update', error);
            }
        },

        async setSecretHash(clientId, secretHash) {
            try {
                const { meta } = await db
                    .prepare(
                        `UPDATE db_oidc_clients SET secret_hash = ?2, updated_at = ?3
                         WHERE client_id = ?1 AND secret_hash IS NOT NULL`
                    )
                    .bind(clientId, secretHash, iso(now()))
                    .run();
                return meta.changes > 0;
            } catch (error) {
                throw new DataError('oidc.clients.secret', error);
            }
        },

        async delete(clientId) {
            try {
                const grants = 'SELECT id FROM db_oidc_grants WHERE client_id = ?1';
                const results = await db.batch([
                    db
                        .prepare(`DELETE FROM db_oidc_refresh_tokens WHERE grant_id IN (${grants})`)
                        .bind(clientId),
                    db
                        .prepare(`DELETE FROM db_oidc_codes WHERE grant_id IN (${grants})`)
                        .bind(clientId),
                    db.prepare('DELETE FROM db_oidc_grants WHERE client_id = ?1').bind(clientId),
                    db
                        .prepare(
                            'DELETE FROM db_oidc_clients WHERE client_id = ?1 RETURNING client_id'
                        )
                        .bind(clientId)
                ]);
                return (results[3]?.results.length ?? 0) > 0;
            } catch (error) {
                throw new DataError('oidc.clients.delete', error);
            }
        }
    };
}

export function createD1OidcAuthStore(db: D1Like, now: () => number = Date.now): OidcAuthStore {
    async function activeGrant(clientId: string): Promise<OidcGrant | null> {
        const row = await db
            .prepare(`${GRANT_SELECT} WHERE g.client_id = ?1 AND g.revoked_at IS NULL`)
            .bind(clientId)
            .first();
        return row ? grantRow(row) : null;
    }

    async function revokeGrantById(grantId: number, at: string) {
        await db.batch([
            db
                .prepare(
                    'UPDATE db_oidc_grants SET revoked_at = ?2 WHERE id = ?1 AND revoked_at IS NULL'
                )
                .bind(grantId, at),
            db
                .prepare(
                    'UPDATE db_oidc_refresh_tokens SET revoked_at = ?2 WHERE grant_id = ?1 AND revoked_at IS NULL'
                )
                .bind(grantId, at),
            db.prepare('DELETE FROM db_oidc_codes WHERE grant_id = ?1').bind(grantId)
        ]);
    }

    return {
        async subject() {
            try {
                await db.prepare('INSERT OR IGNORE INTO db_oidc_subject (id) VALUES (1)').run();
                const row = await db
                    .prepare('SELECT subject FROM db_oidc_subject WHERE id = 1')
                    .first<{ subject: string }>();
                if (!row) throw new Error('The subject row is missing.');
                return row.subject;
            } catch (error) {
                throw new DataError('oidc.subject', error);
            }
        },

        async activeGrant(clientId) {
            try {
                return await activeGrant(clientId);
            } catch (error) {
                throw new DataError('oidc.grants.active', error);
            }
        },

        async grant(clientId, scopes) {
            try {
                const existing = await activeGrant(clientId);
                if (existing) {
                    const merged = [...new Set([...existing.scopes, ...scopes])];
                    if (merged.length !== existing.scopes.length)
                        await db
                            .prepare('UPDATE db_oidc_grants SET scopes = ?2 WHERE public_id = ?1')
                            .bind(existing.id, JSON.stringify(merged))
                            .run();
                    return { ...existing, scopes: merged };
                }
                await db
                    .prepare('INSERT INTO db_oidc_grants (client_id, scopes) VALUES (?1, ?2)')
                    .bind(clientId, JSON.stringify([...new Set(scopes)]))
                    .run();
                const created = await activeGrant(clientId);
                if (!created) throw new Error('The grant was not created.');
                return created;
            } catch (error) {
                throw new DataError('oidc.grants.grant', error);
            }
        },

        async listGrants() {
            try {
                const { results } = await db
                    .prepare(
                        `${GRANT_SELECT} WHERE g.revoked_at IS NULL
                         ORDER BY coalesce(g.last_used_at, g.created_at) DESC, g.id DESC`
                    )
                    .all();
                return results.map(grantRow);
            } catch (error) {
                throw new DataError('oidc.grants.list', error);
            }
        },

        async revokeGrant(grantId) {
            try {
                const row = await db
                    .prepare(
                        'SELECT id FROM db_oidc_grants WHERE public_id = ?1 AND revoked_at IS NULL'
                    )
                    .bind(grantId)
                    .first<{ id: number }>();
                if (!row) return false;
                await revokeGrantById(row.id, iso(now()));
                return true;
            } catch (error) {
                throw new DataError('oidc.grants.revoke', error);
            }
        },

        async issueCode(input) {
            try {
                await db
                    .prepare(
                        `INSERT INTO db_oidc_codes
                           (code_hash, grant_id, redirect_uri, scopes, nonce, code_challenge, auth_time, expires_at)
                         VALUES (?1, (SELECT id FROM db_oidc_grants WHERE public_id = ?2 AND revoked_at IS NULL),
                                 ?3, ?4, ?5, ?6, ?7, ?8)`
                    )
                    .bind(
                        input.codeHash,
                        input.grantId,
                        input.redirectUri,
                        JSON.stringify(input.scopes),
                        input.nonce,
                        input.codeChallenge,
                        input.authTime,
                        input.expiresAt
                    )
                    .run();
            } catch (error) {
                throw new DataError('oidc.codes.issue', error);
            }
        },

        async consumeCode(codeHash) {
            const at = iso(now());
            try {
                const used = await db
                    .prepare(
                        `UPDATE db_oidc_codes SET used_at = ?2
                         WHERE code_hash = ?1 AND used_at IS NULL AND expires_at > ?2
                         RETURNING grant_id, redirect_uri, scopes, nonce, code_challenge, auth_time`
                    )
                    .bind(codeHash, at)
                    .first();
                if (!used) {
                    const previous = await db
                        .prepare('SELECT grant_id, used_at FROM db_oidc_codes WHERE code_hash = ?1')
                        .bind(codeHash)
                        .first<{ grant_id: number; used_at: string | null }>();
                    if (previous?.used_at) {
                        await revokeGrantById(previous.grant_id, at);
                        return { status: 'reused' };
                    }
                    return { status: 'invalid' };
                }
                const grant = await db
                    .prepare(
                        `UPDATE db_oidc_grants SET last_used_at = ?2
                         WHERE id = ?1 AND revoked_at IS NULL RETURNING public_id, client_id`
                    )
                    .bind(used.grant_id, at)
                    .first<{ public_id: string; client_id: string }>();
                if (!grant) return { status: 'invalid' };
                return {
                    status: 'ok',
                    code: {
                        grantId: grant.public_id,
                        clientId: grant.client_id,
                        redirectUri: String(used.redirect_uri),
                        scopes: jsonStrings(used.scopes),
                        nonce: typeof used.nonce === 'string' ? used.nonce : null,
                        codeChallenge: String(used.code_challenge),
                        authTime: Number(used.auth_time)
                    }
                };
            } catch (error) {
                throw new DataError('oidc.codes.consume', error);
            }
        },

        async issueRefresh(input) {
            try {
                await db
                    .prepare(
                        `INSERT INTO db_oidc_refresh_tokens (token_hash, grant_id, scopes, auth_time, expires_at)
                         VALUES (?1, (SELECT id FROM db_oidc_grants WHERE public_id = ?2 AND revoked_at IS NULL),
                                 ?3, ?4, ?5)`
                    )
                    .bind(
                        input.tokenHash,
                        input.grantId,
                        JSON.stringify(input.scopes),
                        input.authTime,
                        input.expiresAt
                    )
                    .run();
            } catch (error) {
                throw new DataError('oidc.refresh.issue', error);
            }
        },

        async rotateRefresh(tokenHash, clientId, next) {
            const at = iso(now());
            try {
                const row = await db
                    .prepare(
                        `SELECT t.scopes, t.auth_time, t.expires_at, t.rotated_at, t.revoked_at,
                                g.id AS grant_row, g.public_id, g.client_id, g.revoked_at AS grant_revoked_at
                         FROM db_oidc_refresh_tokens t JOIN db_oidc_grants g ON g.id = t.grant_id
                         WHERE t.token_hash = ?1`
                    )
                    .bind(tokenHash)
                    .first();
                if (!row || row.client_id !== clientId) return { status: 'invalid' };
                if (row.grant_revoked_at || row.revoked_at) return { status: 'invalid' };
                const grantRowId = Number(row.grant_row);
                if (row.rotated_at) {
                    await revokeGrantById(grantRowId, at);
                    return { status: 'reused' };
                }
                if (String(row.expires_at) <= at) return { status: 'invalid' };
                const granted = jsonStrings(row.scopes);
                if (next.scopes?.some(scope => !granted.includes(scope)))
                    return { status: 'invalid_scope' };

                const { meta } = await db
                    .prepare(
                        `UPDATE db_oidc_refresh_tokens SET rotated_at = ?2
                         WHERE token_hash = ?1 AND rotated_at IS NULL AND revoked_at IS NULL`
                    )
                    .bind(tokenHash, at)
                    .run();
                if (meta.changes === 0) {
                    await revokeGrantById(grantRowId, at);
                    return { status: 'reused' };
                }
                await db.batch([
                    db
                        .prepare(
                            `INSERT INTO db_oidc_refresh_tokens (token_hash, grant_id, scopes, auth_time, expires_at)
                             VALUES (?1, ?2, ?3, ?4, ?5)`
                        )
                        .bind(
                            next.tokenHash,
                            grantRowId,
                            row.scopes,
                            row.auth_time,
                            row.expires_at
                        ),
                    db
                        .prepare('UPDATE db_oidc_grants SET last_used_at = ?2 WHERE id = ?1')
                        .bind(grantRowId, at)
                ]);
                return {
                    status: 'rotated',
                    token: {
                        grantId: String(row.public_id),
                        clientId: String(row.client_id),
                        scopes: granted,
                        authTime: Number(row.auth_time)
                    }
                };
            } catch (error) {
                throw new DataError('oidc.refresh.rotate', error);
            }
        },

        async revokeGrantByRefresh(tokenHash, clientId) {
            try {
                const row = await db
                    .prepare(
                        `SELECT g.id FROM db_oidc_refresh_tokens t JOIN db_oidc_grants g ON g.id = t.grant_id
                         WHERE t.token_hash = ?1 AND g.client_id = ?2 AND g.revoked_at IS NULL`
                    )
                    .bind(tokenHash, clientId)
                    .first<{ id: number }>();
                if (!row) return false;
                await revokeGrantById(row.id, iso(now()));
                return true;
            } catch (error) {
                throw new DataError('oidc.refresh.revoke', error);
            }
        },

        async prune() {
            const current = now();
            try {
                await db.batch([
                    db
                        .prepare('DELETE FROM db_oidc_codes WHERE expires_at < ?1')
                        .bind(iso(current - CODE_RETENTION_MS)),
                    db
                        .prepare('DELETE FROM db_oidc_refresh_tokens WHERE expires_at < ?1')
                        .bind(iso(current))
                ]);
            } catch (error) {
                throw new DataError('oidc.prune', error);
            }
        }
    };
}
