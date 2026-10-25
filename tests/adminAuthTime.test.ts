import { describe, expect, mock, test } from 'bun:test';

mock.module('$app/env/private', () => ({}));
mock.module('$app/env/public', () => ({}));

const { safeGetSession } = await import('../packages/lib/src/server/supabaseAuth.ts');
type AuthClient = Parameters<typeof safeGetSession>[0];

function client(methods: unknown[], issuedAt: number) {
    return {
        auth: {
            getUser: async () => ({
                data: {
                    user: { id: 'u-1', email: 'ada@example.com', app_metadata: { role: 'admin' } }
                },
                error: null
            }),
            getSession: async () => ({
                data: { session: { access_token: 'token', expires_at: issuedAt + 3600 } }
            }),
            mfa: {
                getAuthenticatorAssuranceLevel: async () => ({
                    data: {
                        currentLevel: 'aal2',
                        nextLevel: 'aal2',
                        currentAuthenticationMethods: methods
                    },
                    error: null
                })
            }
        }
    } as unknown as AuthClient;
}

describe('admin authentication time', () => {
    test('uses the newest sign-in step, not the time the session was refreshed', async () => {
        const methods = [
            { method: 'password', timestamp: 1_000 },
            { method: 'totp', timestamp: 1_300 }
        ];
        const session = await safeGetSession(client(methods, 9_000_000))();
        expect(session).toMatchObject({ mfaSatisfied: true, authTime: 1_300 });
    });

    test('treats a session without sign-in timestamps as never freshly signed in', async () => {
        const session = await safeGetSession(client([{ method: 'password' }], 9_000_000))();
        expect(session?.authTime).toBe(0);
    });
});
