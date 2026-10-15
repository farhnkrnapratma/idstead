import { afterEach, describe, expect, mock, test } from 'bun:test';

mock.module('$app/env/private', () => ({ TURNSTILE_SECRET: 'turnstile-secret', IP_SALT: 'salt' }));
mock.module('$app/env/public', () => ({
    PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test'
}));

const { POST: login } =
    await import('../apps/admin/src/routes/api/internal/admin/login/+server.ts');

const realFetch = globalThis.fetch;
const siteverifyTokens: string[] = [];

function stubSiteverify(success: boolean) {
    siteverifyTokens.length = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes('/turnstile/v0/siteverify')) {
            siteverifyTokens.push(new URLSearchParams(String(init?.body)).get('response') ?? '');
            return Response.json({ success });
        }
        return new Response('{}', { status: 503 });
    }) as typeof fetch;
}

afterEach(() => {
    globalThis.fetch = realFetch;
});

function loginEvent(body: Record<string, unknown>, signIn: (credentials: unknown) => unknown) {
    const url = new URL('https://admin.example.com/api/internal/admin/login');
    return {
        url,
        platform: undefined,
        getClientAddress: () => '203.0.113.20',
        request: new Request(url, {
            method: 'POST',
            headers: { origin: url.origin, 'content-type': 'application/json' },
            body: JSON.stringify(body)
        }),
        locals: { supabase: { auth: { signInWithPassword: signIn } } }
    } as never;
}

describe('admin login CAPTCHA', () => {
    test('verifies the route token itself and forwards the second token to Supabase Auth', async () => {
        stubSiteverify(true);
        const calls: unknown[] = [];
        const response = await login(
            loginEvent(
                {
                    email: 'admin@example.com',
                    password: 'wrong',
                    turnstileToken: 'route-token',
                    captchaToken: 'supabase-token'
                },
                credentials => {
                    calls.push(credentials);
                    return { data: { session: null }, error: { code: 'invalid_credentials' } };
                }
            )
        );
        expect(siteverifyTokens).toEqual(['route-token']);
        expect(calls).toEqual([
            {
                email: 'admin@example.com',
                password: 'wrong',
                options: { captchaToken: 'supabase-token' }
            }
        ]);
        expect(response.status).toBe(401);
    });

    test('maps a Supabase CAPTCHA rejection to the Turnstile error', async () => {
        stubSiteverify(true);
        const response = await login(
            loginEvent(
                {
                    email: 'admin@example.com',
                    password: 'secret',
                    turnstileToken: 'route-token',
                    captchaToken: 'stale-token'
                },
                () => ({ data: { session: null }, error: { code: 'captcha_failed' } })
            )
        );
        expect(response.status).toBe(403);
        expect((await response.json()).code).toBe('ADMIN_LOGIN_TURNSTILE_FAILED');
    });

    test('never reaches Supabase Auth when the route token fails', async () => {
        stubSiteverify(false);
        let called = false;
        const response = await login(
            loginEvent(
                {
                    email: 'admin@example.com',
                    password: 'secret',
                    turnstileToken: 'bad-token',
                    captchaToken: 'supabase-token'
                },
                () => {
                    called = true;
                    return { data: { session: null }, error: null };
                }
            )
        );
        expect(response.status).toBe(403);
        expect(called).toBe(false);
    });
});
