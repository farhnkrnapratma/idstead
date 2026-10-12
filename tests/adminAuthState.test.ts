import { describe, expect, test } from 'bun:test';
import {
    inspectAdminAuth,
    requiresAdminMfa,
    resolveAdminAuthStatus
} from '../packages/lib/src/adminAuthState';

function authClient(
    status:
        | 'signed-out'
        | 'mfa-required'
        | 'authenticated'
        | 'unauthorized'
        | 'invalid'
        | 'invalid-assurance' = 'signed-out'
) {
    return {
        auth: {
            getSession: async () => ({
                data: { session: status === 'signed-out' ? null : { access_token: 'test-token' } },
                error: null
            }),
            getUser: async () => ({
                data: {
                    user:
                        status === 'unauthorized' ?
                            { app_metadata: { role: 'user' } }
                        :   { app_metadata: { role: 'admin' } }
                },
                error: status === 'invalid' ? new Error('Session expired') : null
            }),
            mfa: {
                getAuthenticatorAssuranceLevel: async () => ({
                    data:
                        status === 'mfa-required' ?
                            { currentLevel: 'aal1', nextLevel: 'aal2' }
                        :   { currentLevel: 'aal2', nextLevel: 'aal2' },
                    error:
                        status === 'invalid-assurance' ? new Error('Assurance check failed') : null
                })
            },
            signOut: async () => ({ error: null })
        }
    };
}

describe('admin authentication state', () => {
    test('requires MFA when the session is AAL1 and the next level is AAL2', () => {
        const assurance = { currentLevel: 'aal1', nextLevel: 'aal2' };

        expect(requiresAdminMfa(assurance)).toBe(true);
        expect(resolveAdminAuthStatus('admin', assurance)).toBe('mfa-required');
    });

    test('accepts an admin session after MFA reaches AAL2', () => {
        expect(resolveAdminAuthStatus('admin', { currentLevel: 'aal2', nextLevel: 'aal2' })).toBe(
            'authenticated'
        );
    });

    test('accepts an admin session when no second factor is required', () => {
        expect(resolveAdminAuthStatus('admin', { currentLevel: 'aal1', nextLevel: 'aal1' })).toBe(
            'authenticated'
        );
    });

    test('accepts a passkey sign-in as satisfying MFA without a TOTP code', () => {
        const assurance = {
            currentLevel: 'aal1',
            nextLevel: 'aal2',
            currentAuthenticationMethods: [{ method: 'passkey', timestamp: 1 }]
        };

        expect(requiresAdminMfa(assurance)).toBe(false);
        expect(resolveAdminAuthStatus('admin', assurance)).toBe('authenticated');
        expect(resolveAdminAuthStatus('user', assurance)).toBe('unauthorized');
    });

    test('still requires TOTP after a password sign-in', () => {
        const assurance = {
            currentLevel: 'aal1',
            nextLevel: 'aal2',
            currentAuthenticationMethods: [{ method: 'password', timestamp: 1 }]
        };

        expect(requiresAdminMfa(assurance)).toBe(true);
    });

    test('rejects non-admin users and missing assurance data', () => {
        const assurance = { currentLevel: 'aal2', nextLevel: 'aal2' };

        expect(resolveAdminAuthStatus('user', assurance)).toBe('unauthorized');
        expect(resolveAdminAuthStatus('admin', null)).toBe('invalid');
    });

    test('does not treat a session without AAL2 as an authenticated admin session', async () => {
        expect(await inspectAdminAuth(authClient('mfa-required'))).toEqual({
            status: 'mfa-required'
        });
    });

    test('recognizes completed admin sessions after password or passkey sign-in', async () => {
        expect(await inspectAdminAuth(authClient('authenticated'))).toEqual({
            status: 'authenticated'
        });
    });

    test('returns a recoverable state for missing or expired sessions', async () => {
        expect(await inspectAdminAuth(authClient('signed-out'))).toEqual({ status: 'signed-out' });
        expect((await inspectAdminAuth(authClient('invalid'))).status).toBe('invalid');
        expect((await inspectAdminAuth(authClient('invalid-assurance'))).status).toBe('invalid');
    });
});
