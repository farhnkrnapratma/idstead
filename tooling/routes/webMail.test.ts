// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { slot } from './support.ts';

const TOKEN = 'a'.repeat(64);

const state = {
    body: {} as Record<string, unknown> | null,
    response: null as Response | null,
    contactLinks: [{ platform: 'Email', href: 'mailto:hi@example.com', displayValue: '' }] as any[],
    contactError: false,
    profile: { name: 'Ada', email: 'ada@example.com' } as any,
    profileError: false,
    data: undefined as any,
    salt: 'salt' as string | null,
    emailOk: true,
    siteverify: { ok: true, success: true } as { ok: boolean; success: boolean; throws?: boolean },
    sent: [] as any[],
    verifications: [] as string[],
    notified: [] as string[],
    notifyError: false,
    subscribeResult: 'requested' as string,
    subscribeError: false,
    cancelled: [] as unknown[],
    cancelError: false,
    unsubscribeToken: TOKEN as string | null,
    unsubscribeResult: 'unsubscribed' as string,
    unsubscribeError: false,
    status: 'subscribed' as string | null,
    statusError: false
};

const realFetch = globalThis.fetch;

function installFetch() {
    globalThis.fetch = (async (input: any, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('siteverify')) {
            state.verifications.push(String(init?.body));
            if (state.siteverify.throws) throw new Error('network');
            return Response.json(
                { success: state.siteverify.success },
                { status: state.siteverify.ok ? 200 : 500 }
            );
        }
        state.sent.push(JSON.parse(String(init?.body)));
        return new Response('x', { status: state.emailOk ? 200 : 500 });
    }) as never;
}

const setup = () => {
    slot.readPublicWrite = async () =>
        state.response ? { response: state.response } : { body: state.body };
    slot.publicRepositories = () => ({
        author: {
            contactLinks: () =>
                state.contactError ?
                    Promise.reject(new Error('x'))
                :   Promise.resolve(state.contactLinks),
            profile: () =>
                state.profileError ? Promise.reject(new Error('x')) : Promise.resolve(state.profile)
        }
    });
    slot.serviceData = () => state.data;
    slot.ipSalt = () => state.salt;
};
setup();

const contact = await import('../../apps/web/src/routes/api/internal/contact/+server.ts');
const subscribe = await import('../../apps/web/src/routes/api/internal/subscribe/+server.ts');
const unsubscribeRequest =
    await import('../../apps/web/src/routes/api/internal/subscribe/unsubscribe-request/+server.ts');
const unsubscribePage = await import('../../apps/web/src/routes/unsubscribe/+page.server.ts');
const { verifyTurnstileToken } = await import('../../packages/lib/src/server/turnstile.ts');

const env = {
    RESEND_API_KEY: 'key',
    SUBSCRIBER_FROM_EMAIL: 'Site <site@example.com>',
    TURNSTILE_SECRET: 'secret'
};
let platform: { env: Record<string, string> };

function event(
    init: {
        body?: unknown;
        headers?: Record<string, string>;
        cf?: unknown;
        url?: string;
        raw?: string;
    } = {}
) {
    const url = new URL(init.url ?? 'https://example.com/api/internal/x');
    const request = new Request(url, {
        method: 'POST',
        headers: { origin: url.origin, 'content-type': 'application/json', ...init.headers },
        body: init.raw ?? JSON.stringify(init.body ?? {})
    });
    if (init.cf) (request as any).cf = init.cf;
    return { request, url, platform, getClientAddress: () => '203.0.113.7' } as any;
}

async function code(response: Response) {
    const body = (await response.json()) as any;
    return body.code ?? body.error?.code;
}

beforeEach(() => {
    setup();
    installFetch();
    platform = { env: { ...env } };
    state.body = {};
    state.response = null;
    state.contactLinks = [{ platform: 'Email', href: 'mailto:hi@example.com', displayValue: '' }];
    state.contactError = false;
    state.profile = { name: 'Ada', email: 'ada@example.com' };
    state.profileError = false;
    state.salt = 'salt';
    state.emailOk = true;
    state.siteverify = { ok: true, success: true };
    state.sent = [];
    state.verifications = [];
    state.notified = [];
    state.notifyError = false;
    state.subscribeResult = 'requested';
    state.subscribeError = false;
    state.cancelled = [];
    state.cancelError = false;
    state.unsubscribeToken = TOKEN;
    state.unsubscribeResult = 'unsubscribed';
    state.unsubscribeError = false;
    state.status = 'subscribed';
    state.statusError = false;
    state.data = {
        writers: {
            notifications: {
                notify: async (kind: string) => {
                    if (state.notifyError) throw new Error('x');
                    state.notified.push(kind);
                }
            },
            subscribers: {
                request: async () => {
                    if (state.subscribeError) throw new Error('x');
                    return state.subscribeResult;
                },
                cancelConfirmation: async (...args: unknown[]) => {
                    if (state.cancelError) throw new Error('x');
                    state.cancelled.push(args);
                },
                unsubscribeTokenFor: async () => state.unsubscribeToken,
                statusByUnsubscribeToken: async () => {
                    if (state.statusError) throw new Error('x');
                    return state.status;
                },
                unsubscribe: async () => {
                    if (state.unsubscribeError) throw new Error('x');
                    return state.unsubscribeResult;
                }
            }
        }
    };
});

afterEach(() => {
    globalThis.fetch = realFetch;
});

const quiet = async <T>(run: () => Promise<T>): Promise<T> => {
    const original = console.error;
    console.error = () => {};
    try {
        return await run();
    } finally {
        console.error = original;
    }
};

describe('POST /api/internal/contact', () => {
    const message = {
        kind: 'message',
        name: 'Grace',
        email: 'grace@example.com',
        message: 'Hello'
    };
    const send = (body: Record<string, unknown> | null, init: Parameters<typeof event>[0] = {}) => {
        state.body = body;
        return (contact.POST as any)(event(init)) as Promise<Response>;
    };

    test('returns the public write failure and validates input', async () => {
        state.response = Response.json({ code: 'T' }, { status: 403 });
        expect((await send(message)).status).toBe(403);
        state.response = null;
        const cases: Array<[Record<string, unknown> | null, string]> = [
            [null, 'CONTACT_KIND_INVALID'],
            [{ ...message, kind: 'other' }, 'CONTACT_KIND_INVALID'],
            [{ ...message, name: ' ' }, 'CONTACT_NAME_REQUIRED'],
            [{ ...message, email: 'bad' }, 'CONTACT_EMAIL_INVALID'],
            [{ ...message, message: '' }, 'CONTACT_MESSAGE_REQUIRED'],
            [{ ...message, kind: 'feedback' }, 'CONTACT_URL_REQUIRED']
        ];
        for (const [body, expected] of cases) expect(await code(await send(body))).toBe(expected);
    });

    test('needs a recipient and delivery settings', async () => {
        state.contactLinks = [];
        state.profile = { email: '' };
        expect((await send(message)).status).toBe(503);
        state.profile = null;
        expect((await send(message)).status).toBe(503);
        state.contactError = true;
        state.profileError = true;
        expect((await send(message)).status).toBe(503);
        state.contactError = false;
        state.profileError = false;
        state.profile = { email: 'ada@example.com' };
        expect((await send(message)).status).toBe(201);
        expect(state.sent[0].to).toEqual(['ada@example.com']);
        platform.env.RESEND_API_KEY = '';
        expect(await code(await send(message))).toBe('CONTACT_DELIVERY_UNAVAILABLE');
    });

    test('resolves the recipient from the contact links', async () => {
        state.contactLinks = [
            { platform: 'Phone', href: 'tel:1', displayValue: '1' },
            {
                platform: 'Mail',
                href: 'mailto:shown@example.com',
                displayValue: 'Shown <shown@example.com>'
            }
        ];
        await send(message);
        expect(state.sent[0].to).toEqual(['Shown <shown@example.com>']);
        state.contactLinks = [
            { platform: 'Mail', href: 'mailto:plain@example.com', displayValue: '' }
        ];
        await send(message);
        expect(state.sent[1].to).toEqual(['plain@example.com']);
    });

    test('sends messages and feedback with sender details', async () => {
        const response = await send(
            {
                ...message,
                kind: 'feedback',
                url: 'https://example.com/blog/x',
                timeZone: 'Asia/Jakarta'
            },
            {
                headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0' },
                cf: { city: 'Jakarta', country: 'id', timezone: 'Asia/Jakarta' }
            }
        );
        expect(response.status).toBe(201);
        expect(state.notified).toEqual(['feedback_report']);
        expect(state.sent[0].text).toContain('Jakarta');
        await send(message, { cf: { city: 5, country: 'ZZZ', timezone: 'Mars/Base' } });
        await send(message, { cf: { city: 'Oslo', country: 'NO', timezone: 'Europe/Oslo' } });
        await send({ ...message, timeZone: 'Nope/Zone' }, { cf: { timezone: 'Europe/Oslo' } });
        await send(message);
        expect(state.notified).toEqual([
            'feedback_report',
            'contact_message',
            'contact_message',
            'contact_message',
            'contact_message'
        ]);
    });

    test('falls back to the country code when names are unavailable', async () => {
        const original = Intl.DisplayNames;
        (Intl as any).DisplayNames = class {
            of() {
                throw new RangeError('unsupported');
            }
        };
        try {
            await send(message, { cf: { country: 'id' } });
        } finally {
            (Intl as any).DisplayNames = original;
        }
        expect(state.sent.at(-1).text).toContain('ID');
    });

    test('fails when the recipient lookup breaks', async () => {
        slot.publicRepositories = () => {
            throw new Error('repositories');
        };
        const response = await quiet(() => send(message));
        expect(response.status).toBe(500);
        expect(await code(response)).toBe('CONTACT_RECIPIENT_LOOKUP_FAILED');
    });

    test('reports delivery and notification failures', async () => {
        state.emailOk = false;
        expect((await quiet(() => send(message))).status).toBe(502);
        state.emailOk = true;
        state.notifyError = true;
        expect((await quiet(() => send(message))).status).toBe(201);
        state.data = undefined;
        expect((await send(message)).status).toBe(201);
    });
});

describe('POST /api/internal/subscribe', () => {
    const post = (body: unknown, init: Parameters<typeof event>[0] = {}) =>
        (subscribe.POST as any)(event({ body, ...init })) as Promise<Response>;
    const valid = { email: 'Reader@Example.com ', turnstileToken: 'tok' };

    test('guards origin, body, email and challenge', async () => {
        expect((await post(valid, { headers: { origin: 'https://evil.example' } })).status).toBe(
            403
        );
        expect(await code(await post(null, { raw: '{nope' }))).toBe('INVALID_JSON_BODY');
        expect(await code(await post({ email: 'bad' }))).toBe('SUBSCRIBE_INVALID_EMAIL');
        state.siteverify = { ok: true, success: false };
        expect(await code(await post(valid))).toBe('SUBSCRIBE_TURNSTILE_FAILED');
        expect(await code(await post({ email: 'a@b.co' }))).toBe('SUBSCRIBE_TURNSTILE_FAILED');
    });

    test('needs storage and delivery settings', async () => {
        state.data = undefined;
        expect((await post(valid)).status).toBe(503);
        state.data = { writers: { subscribers: undefined } };
        expect((await post(valid)).status).toBe(503);
    });

    test('requests confirmation and sends the email', async () => {
        const response = await post(valid);
        expect(await response.json()).toMatchObject({ ok: true });
        expect(state.sent[0].to).toEqual(['reader@example.com']);
        expect(state.sent[0].text).toContain('/subscribe/confirm?token=');
        state.salt = null;
        state.profile = null;
        await post(valid);
        expect(state.sent[1].html).toContain('example.com');
        state.subscribeResult = 'pending';
        const before = state.sent.length;
        expect((await post(valid)).status).toBe(200);
        expect(state.sent).toHaveLength(before);
    });

    test('handles missing delivery keys and storage failures', async () => {
        const original = platform.env.RESEND_API_KEY;
        platform.env.RESEND_API_KEY = '';
        expect(await code(await post(valid))).toBe('SUBSCRIBE_UNAVAILABLE');
        platform.env.RESEND_API_KEY = original;
        state.subscribeError = true;
        expect((await quiet(() => post(valid))).status).toBe(503);
    });

    test('cancels the confirmation when the email cannot be sent', async () => {
        state.emailOk = false;
        const response = await quiet(() => post(valid));
        expect(response.status).toBe(502);
        expect(state.cancelled).toHaveLength(1);
        state.cancelError = true;
        expect((await quiet(() => post(valid))).status).toBe(502);
    });
});

describe('POST /api/internal/subscribe/unsubscribe-request', () => {
    const post = (body: unknown, init: Parameters<typeof event>[0] = {}) =>
        (unsubscribeRequest.POST as any)(event({ body, ...init })) as Promise<Response>;
    const valid = { email: 'reader@example.com', turnstileToken: 'tok' };

    test('validates the request', async () => {
        expect((await post(valid, { headers: { origin: 'https://evil.example' } })).status).toBe(
            403
        );
        expect(await code(await post(null, { raw: '{nope' }))).toBe('UNSUBSCRIBE_INVALID_BODY');
        expect(await code(await post([1]))).toBe('UNSUBSCRIBE_INVALID_BODY');
        expect(await code(await post({ email: 'bad' }))).toBe('UNSUBSCRIBE_INVALID_EMAIL');
        expect(await code(await post({ email: 5 }))).toBe('UNSUBSCRIBE_INVALID_EMAIL');
        state.siteverify = { ok: true, success: false };
        expect(await code(await post(valid))).toBe('UNSUBSCRIBE_TURNSTILE_FAILED');
        expect(await code(await post({ email: 'a@b.co' }))).toBe('UNSUBSCRIBE_TURNSTILE_FAILED');
    });

    test('needs storage and delivery settings', async () => {
        state.data = undefined;
        expect((await post(valid)).status).toBe(503);
        state.data = { writers: { subscribers: {} } };
        platform.env.RESEND_API_KEY = '';
        expect((await post(valid)).status).toBe(503);
    });

    test('sends a link only for known subscribers', async () => {
        const known = await post(valid);
        expect(await known.json()).toMatchObject({ ok: true });
        expect(state.sent[0].text).toContain(`/unsubscribe?token=${TOKEN}`);
        state.profile = null;
        state.profileError = true;
        await post(valid);
        expect(state.sent).toHaveLength(2);
        state.unsubscribeToken = null;
        expect((await post(valid)).status).toBe(200);
        expect(state.sent).toHaveLength(2);
    });

    test('fails when the token or the email is unusable', async () => {
        state.unsubscribeToken = 'short';
        expect((await post(valid)).status).toBe(503);
        state.unsubscribeToken = TOKEN;
        state.emailOk = false;
        expect((await quiet(() => post(valid))).status).toBe(503);
    });
});

describe('unsubscribe page', () => {
    function cookies(initial: Record<string, string> = {}) {
        const jar = new Map(Object.entries(initial));
        return {
            jar,
            get: (name: string) => jar.get(name),
            set: (name: string, value: string) => void jar.set(name, value),
            delete: (name: string) => void jar.delete(name)
        } as any;
    }
    const load = async (search: string, jar = cookies()) => {
        try {
            return {
                data: await (unsubscribePage.load as any)({
                    url: new URL(`https://example.com/unsubscribe${search}`),
                    platform,
                    cookies: jar
                })
            };
        } catch (error: any) {
            return { redirect: error.location as string, jar };
        }
    };

    test('shows result states without a token', async () => {
        expect((await load('')).data).toEqual({ state: 'invalid' });
        expect((await load('?state=confirm')).data).toEqual({ state: 'invalid' });
        expect((await load('?state=confirm', cookies({ unsubscribe_token: TOKEN }))).data).toEqual({
            state: 'confirm'
        });
        for (const state of ['invalid', 'unavailable', 'unsubscribed'])
            expect((await load(`?state=${state}`)).data).toEqual({ state });
        expect((await load('?state=other')).data).toEqual({ state: 'invalid' });
    });

    test('redirects after checking the token', async () => {
        expect((await load('?token=bad')).redirect).toContain('state=invalid');
        state.data = undefined;
        expect((await load(`?token=${TOKEN}`)).redirect).toContain('state=unavailable');
        setup();
        state.data = {
            writers: {
                subscribers: {
                    statusByUnsubscribeToken: async () => {
                        if (state.statusError) throw new Error('x');
                        return state.status;
                    }
                }
            }
        };
        state.statusError = true;
        expect((await quiet(() => load(`?token=${TOKEN}`))).redirect).toContain(
            'state=unavailable'
        );
        state.statusError = false;
        state.status = null;
        expect((await load(`?token=${TOKEN}`)).redirect).toContain('state=invalid');
        state.status = 'unsubscribed';
        expect((await load(`?token=${TOKEN}`)).redirect).toContain('state=unsubscribed');
        state.status = 'subscribed';
        const jar = cookies();
        const result = await load(`?token=${TOKEN}`, jar);
        expect(result.redirect).toContain('state=confirm');
        expect(jar.jar.get('unsubscribe_token')).toBe(TOKEN);
        expect(result.redirect).not.toContain('token=');
    });

    test('unsubscribes with the stored token', async () => {
        const run = async (jar: any) => {
            try {
                await (unsubscribePage.actions.default as any)({
                    url: new URL('https://example.com/unsubscribe'),
                    platform,
                    cookies: jar
                });
            } catch (error: any) {
                return error.location as string;
            }
            return '';
        };
        expect(await run(cookies())).toContain('state=invalid');
        const missing = state.data;
        state.data = undefined;
        expect(await run(cookies({ unsubscribe_token: TOKEN }))).toContain('state=unavailable');
        state.data = missing;
        state.unsubscribeError = true;
        expect(await quiet(() => run(cookies({ unsubscribe_token: TOKEN })))).toContain(
            'state=unavailable'
        );
        state.unsubscribeError = false;
        const jar = cookies({ unsubscribe_token: TOKEN });
        expect(await run(jar)).toContain('state=unsubscribed');
        expect(jar.jar.has('unsubscribe_token')).toBe(false);
    });
});

describe('verifyTurnstileToken', () => {
    test('rejects missing tokens and secrets', async () => {
        expect(await verifyTurnstileToken('', '203.0.113.1', platform)).toBe(false);
        expect(await verifyTurnstileToken(null, '203.0.113.1', platform)).toBe(false);
        expect(
            await quiet(() =>
                verifyTurnstileToken('t', '203.0.113.1', { env: { TURNSTILE_SECRET: '' } })
            )
        ).toBe(false);
    });

    test('sends the remote address only when it is public', async () => {
        expect(await verifyTurnstileToken('t', '203.0.113.1', platform)).toBe(true);
        expect(state.verifications.at(-1)).toContain('remoteip=203.0.113.1');
        for (const ip of [
            '',
            '127.0.0.1',
            '::1',
            'localhost',
            '10.0.0.1',
            '192.168.1.1',
            '169.254.1.1',
            'fe80::1',
            'fc00::1',
            'fd00::1',
            '172.16.0.1',
            '172.31.255.1'
        ]) {
            await verifyTurnstileToken('t', ip, platform);
            expect(state.verifications.at(-1)).not.toContain('remoteip');
        }
        await verifyTurnstileToken('t', '172.32.0.1', platform);
        expect(state.verifications.at(-1)).toContain('remoteip=172.32.0.1');
    });

    test('fails closed on bad answers and network errors', async () => {
        state.siteverify = { ok: false, success: true };
        expect(await verifyTurnstileToken('t', '203.0.113.1', platform)).toBe(false);
        state.siteverify = { ok: true, success: false };
        expect(await verifyTurnstileToken('t', '203.0.113.1', platform)).toBe(false);
        state.siteverify = { ok: true, success: true, throws: true };
        expect(await quiet(() => verifyTurnstileToken('t', '203.0.113.1', platform))).toBe(false);
    });
});
