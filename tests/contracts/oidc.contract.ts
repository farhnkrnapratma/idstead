// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import type { OidcAuthStore, OidcClientStore } from '../../packages/data/src/index.ts';

interface OidcClock {
    advance(ms: number): void;
}

export type OidcStoresFactory = () => {
    clients: OidcClientStore;
    auth: OidcAuthStore;
    clock: OidcClock;
};

const hash = (char: string) => char.repeat(64);
const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const MINUTE = 60_000;

const confidential = {
    clientId: 'client-confidential-1',
    name: 'Notes',
    redirectUris: ['https://notes.example/callback'],
    secretHash: hash('5')
};

const publicApp = {
    clientId: 'client-public-00001',
    name: 'Reader',
    redirectUris: ['http://localhost:3000/cb'],
    secretHash: null
};

function codeInput(grantId: string, codeHash: string, expiresAt: string) {
    return {
        codeHash,
        grantId,
        redirectUri: 'https://notes.example/callback',
        scopes: ['openid', 'profile'],
        nonce: 'n-1',
        codeChallenge: challenge,
        authTime: 1_790_000_000,
        expiresAt
    };
}

export function oidcContract(name: string, factory: OidcStoresFactory) {
    describe(`OIDC stores (${name})`, () => {
        test('registers clients, keeps secrets out of listings and rotates only confidential ones', async () => {
            const { clients } = factory();
            const created = await clients.create(confidential);
            expect(created).toMatchObject({ clientId: confidential.clientId, confidential: true });
            expect(created).not.toHaveProperty('secretHash');
            await clients.create(publicApp);
            expect((await clients.list()).map(client => client.clientId)).toEqual([
                confidential.clientId,
                publicApp.clientId
            ]);
            expect((await clients.get(confidential.clientId))?.secretHash).toBe(hash('5'));
            expect(await clients.setSecretHash(confidential.clientId, hash('6'))).toBe(true);
            expect((await clients.get(confidential.clientId))?.secretHash).toBe(hash('6'));
            expect(await clients.setSecretHash(publicApp.clientId, hash('7'))).toBe(false);
            const updated = await clients.update(publicApp.clientId, {
                name: ' Reader 2 ',
                redirectUris: ['http://127.0.0.1:4000/cb']
            });
            expect(updated).toMatchObject({
                name: 'Reader 2',
                redirectUris: ['http://127.0.0.1:4000/cb']
            });
            expect(await clients.get('missing-client-id-0')).toBeNull();
        });

        test('keeps one subject and one active grant per client, widening its scopes', async () => {
            const { clients, auth } = factory();
            await clients.create(confidential);
            const subject = await auth.subject();
            expect(subject).toMatch(/^[0-9a-f]{32}$/);
            expect(await auth.subject()).toBe(subject);
            expect(await auth.activeGrant(confidential.clientId)).toBeNull();
            const first = await auth.grant(confidential.clientId, ['openid', 'profile']);
            const second = await auth.grant(confidential.clientId, ['openid', 'email']);
            expect(second.id).toBe(first.id);
            expect(second.scopes).toEqual(['openid', 'profile', 'email']);
            expect(first.clientName).toBe('Notes');
            expect((await auth.listGrants()).map(grant => grant.id)).toEqual([first.id]);
        });

        test('spends a code once, and a second use revokes the grant', async () => {
            const { clients, auth, clock } = factory();
            await clients.create(confidential);
            const grant = await auth.grant(confidential.clientId, ['openid', 'profile']);
            const expiresAt = new Date(Date.now() + 10 * MINUTE).toISOString();
            await auth.issueCode(codeInput(grant.id, hash('a'), expiresAt));
            const used = await auth.consumeCode(hash('a'));
            expect(used).toEqual({
                status: 'ok',
                code: {
                    grantId: grant.id,
                    clientId: confidential.clientId,
                    redirectUri: 'https://notes.example/callback',
                    scopes: ['openid', 'profile'],
                    nonce: 'n-1',
                    codeChallenge: challenge,
                    authTime: 1_790_000_000
                }
            });
            expect(await auth.consumeCode(hash('a'))).toEqual({ status: 'reused' });
            expect(await auth.activeGrant(confidential.clientId)).toBeNull();
            expect(await auth.consumeCode(hash('b'))).toEqual({ status: 'invalid' });

            const next = await auth.grant(confidential.clientId, ['openid']);
            await auth.issueCode(codeInput(next.id, hash('c'), expiresAt));
            clock.advance(11 * MINUTE);
            expect(await auth.consumeCode(hash('c'))).toEqual({ status: 'invalid' });
        });

        test('rotates refresh tokens, revokes the grant on reuse and rejects other clients', async () => {
            const { clients, auth, clock } = factory();
            await clients.create(confidential);
            await clients.create(publicApp);
            const grant = await auth.grant(confidential.clientId, ['openid', 'offline_access']);
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * MINUTE).toISOString();
            await auth.issueRefresh({
                tokenHash: hash('1'),
                grantId: grant.id,
                scopes: ['openid', 'offline_access'],
                authTime: 1_790_000_000,
                expiresAt
            });
            expect(
                await auth.rotateRefresh(hash('1'), publicApp.clientId, {
                    tokenHash: hash('9'),
                    scopes: null
                })
            ).toEqual({ status: 'invalid' });
            const rotated = await auth.rotateRefresh(hash('1'), confidential.clientId, {
                tokenHash: hash('2'),
                scopes: null
            });
            expect(rotated).toEqual({
                status: 'rotated',
                token: {
                    grantId: grant.id,
                    clientId: confidential.clientId,
                    scopes: ['openid', 'offline_access'],
                    authTime: 1_790_000_000
                }
            });
            clock.advance(MINUTE);
            expect((await auth.listGrants())[0]?.lastUsedAt).not.toBeNull();
            expect(
                await auth.rotateRefresh(hash('1'), confidential.clientId, {
                    tokenHash: hash('3'),
                    scopes: null
                })
            ).toEqual({ status: 'reused' });
            expect(await auth.activeGrant(confidential.clientId)).toBeNull();
            expect(
                await auth.rotateRefresh(hash('2'), confidential.clientId, {
                    tokenHash: hash('4'),
                    scopes: null
                })
            ).toEqual({ status: 'invalid' });
        });

        test('checks a narrowed scope before rotating and keeps the first expiry', async () => {
            const { clients, auth, clock } = factory();
            await clients.create(confidential);
            const grant = await auth.grant(confidential.clientId, ['openid', 'offline_access']);
            await auth.issueRefresh({
                tokenHash: hash('1'),
                grantId: grant.id,
                scopes: ['openid', 'offline_access'],
                authTime: 1,
                expiresAt: new Date(Date.now() + 10 * MINUTE).toISOString()
            });
            expect(
                await auth.rotateRefresh(hash('1'), confidential.clientId, {
                    tokenHash: hash('2'),
                    scopes: ['openid', 'email']
                })
            ).toEqual({ status: 'invalid_scope' });
            const rotated = await auth.rotateRefresh(hash('1'), confidential.clientId, {
                tokenHash: hash('2'),
                scopes: ['openid']
            });
            expect(rotated).toMatchObject({
                status: 'rotated',
                token: { scopes: ['openid', 'offline_access'] }
            });
            expect(await auth.activeGrant(confidential.clientId)).not.toBeNull();
            clock.advance(11 * MINUTE);
            expect(
                await auth.rotateRefresh(hash('2'), confidential.clientId, {
                    tokenHash: hash('3'),
                    scopes: null
                })
            ).toEqual({ status: 'invalid' });
        });

        test('revokes the whole grant through a refresh token, and everything of a deleted client', async () => {
            const { clients, auth } = factory();
            await clients.create(confidential);
            const expiresAt = new Date(Date.now() + 24 * 60 * MINUTE).toISOString();
            const grant = await auth.grant(confidential.clientId, ['openid', 'offline_access']);
            const refresh = (char: string) => ({
                tokenHash: hash(char),
                grantId: grant.id,
                scopes: ['openid'],
                authTime: 1,
                expiresAt
            });
            await auth.issueRefresh(refresh('1'));
            await auth.issueRefresh(refresh('2'));
            expect(await auth.revokeGrantByRefresh(hash('1'), 'someone-else-client')).toBe(false);
            expect(await auth.revokeGrantByRefresh(hash('1'), confidential.clientId)).toBe(true);
            expect(await auth.activeGrant(confidential.clientId)).toBeNull();
            for (const char of ['1', '2'])
                expect(
                    await auth.rotateRefresh(hash(char), confidential.clientId, {
                        tokenHash: hash('3'),
                        scopes: null
                    })
                ).toEqual({ status: 'invalid' });
            expect(await auth.revokeGrantByRefresh(hash('2'), confidential.clientId)).toBe(false);

            const second = await auth.grant(confidential.clientId, ['openid']);
            expect(await auth.revokeGrant(second.id)).toBe(true);
            expect(await auth.revokeGrant(second.id)).toBe(false);

            await auth.grant(confidential.clientId, ['openid']);
            expect(await clients.delete(confidential.clientId)).toBe(true);
            expect(await clients.delete(confidential.clientId)).toBe(false);
            expect(await auth.listGrants()).toEqual([]);
            await auth.prune();
        });
    });
}
