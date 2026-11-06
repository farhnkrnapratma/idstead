// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, describe, expect, test } from 'bun:test';
import {
    confirmEmail,
    contactMessageEmail,
    createToken,
    hashIp,
    hashToken,
    isValidEmail,
    newPostEmail,
    normalizeEmail,
    resendApiKey,
    sendBatch,
    sendEmail,
    senderAddress,
    unsubscribeEmail,
    type OutgoingEmail
} from '../packages/lib/src/server/subscribers.ts';

const mail: OutgoingEmail = {
    to: 'reader@example.com',
    subject: 'Hello',
    html: '<p>Hi</p>',
    text: 'Hi'
};

const realFetch = globalThis.fetch;
const realError = console.error;
const env = { key: process.env.RESEND_API_KEY, from: process.env.SUBSCRIBER_FROM_EMAIL };

interface Sent {
    url: string;
    init: RequestInit;
}

function stubFetch(handler: (call: Sent) => Response | Promise<Response>) {
    const calls: Sent[] = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
        const call = { url, init };
        calls.push(call);
        return handler(call);
    }) as never;
    console.error = () => {};
    return calls;
}

afterEach(() => {
    globalThis.fetch = realFetch;
    console.error = realError;
    if (env.key === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = env.key;
    if (env.from === undefined) delete process.env.SUBSCRIBER_FROM_EMAIL;
    else process.env.SUBSCRIBER_FROM_EMAIL = env.from;
});

describe('email helpers', () => {
    test('normalises and validates addresses', () => {
        expect(normalizeEmail('  Reader@Example.COM ')).toBe('reader@example.com');
        expect(normalizeEmail(5)).toBe('');
        expect(isValidEmail('reader@example.com')).toBe(true);
        expect(isValidEmail('reader@example')).toBe(false);
        expect(isValidEmail('a@b.c')).toBe(false);
        expect(isValidEmail(`${'a'.repeat(250)}@example.com`)).toBe(false);
    });

    test('creates unique hex tokens and re-exports hashing', async () => {
        const token = createToken();
        expect(token).toMatch(/^[0-9a-f]{64}$/);
        expect(createToken()).not.toBe(token);
        expect(await hashToken('x')).toHaveLength(64);
        expect(await hashIp('203.0.113.1', 'pepper')).toHaveLength(64);
    });

    test('reads credentials from the platform, then the environment', () => {
        expect(resendApiKey({ env: { RESEND_API_KEY: 'platform' } })).toBe('platform');
        expect(senderAddress({ env: { SUBSCRIBER_FROM_EMAIL: 'a@b.test' } })).toBe('a@b.test');
        process.env.RESEND_API_KEY = 'process';
        process.env.SUBSCRIBER_FROM_EMAIL = 'process@b.test';
        expect(resendApiKey(undefined)).toBe('process');
        expect(senderAddress(undefined)).toBe('process@b.test');
        delete process.env.RESEND_API_KEY;
        delete process.env.SUBSCRIBER_FROM_EMAIL;
        expect(resendApiKey({})).toBe('');
        expect(senderAddress({})).toBe('');
    });
});

describe('sendEmail', () => {
    test('requires configuration', async () => {
        const calls = stubFetch(() => new Response('{}'));
        expect(await sendEmail('', 'from@x.test', mail)).toBe(false);
        expect(await sendEmail('key', '', mail)).toBe(false);
        expect(calls).toHaveLength(0);
    });

    test('posts the payload with optional fields', async () => {
        const calls = stubFetch(() => new Response('{}'));
        expect(await sendEmail('key', 'from@x.test', mail)).toBe(true);
        expect(
            await sendEmail('key', 'from@x.test', {
                ...mail,
                replyTo: 'reply@x.test',
                unsubscribeUrl: 'https://x.test/u'
            })
        ).toBe(true);
        const plain = JSON.parse(calls[0].init.body as string);
        expect(plain).toEqual({
            from: 'from@x.test',
            to: ['reader@example.com'],
            subject: 'Hello',
            html: '<p>Hi</p>',
            text: 'Hi'
        });
        const rich = JSON.parse(calls[1].init.body as string);
        expect(rich.reply_to).toBe('reply@x.test');
        expect(rich.headers['List-Unsubscribe']).toBe('<https://x.test/u>');
        expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer key');
    });

    test('reports provider and network failures', async () => {
        stubFetch(() => new Response('nope', { status: 500 }));
        expect(await sendEmail('key', 'from@x.test', mail)).toBe(false);
        globalThis.fetch = (async () => {
            throw new Error('offline');
        }) as never;
        expect(await sendEmail('key', 'from@x.test', mail)).toBe(false);
    });
});

describe('sendBatch', () => {
    test('skips empty or unconfigured batches', async () => {
        const calls = stubFetch(() => new Response('{}'));
        expect(await sendBatch('', 'from@x.test', [mail])).toEqual({ sent: 0, failed: 0 });
        expect(await sendBatch('key', '', [mail])).toEqual({ sent: 0, failed: 0 });
        expect(await sendBatch('key', 'from@x.test', [])).toEqual({ sent: 0, failed: 0 });
        expect(calls).toHaveLength(0);
    });

    test('chunks by one hundred and adds idempotency keys', async () => {
        const calls = stubFetch(() => new Response('{}'));
        const mails = Array.from({ length: 150 }, () => mail);
        expect(await sendBatch('key', 'from@x.test', mails, 'run-1')).toEqual({
            sent: 150,
            failed: 0
        });
        expect(calls).toHaveLength(2);
        const key = (call: Sent) =>
            (call.init.headers as Record<string, string>)['Idempotency-Key'];
        expect(key(calls[0])).toMatch(/^run-1\/[0-9a-f]{64}$/);
        expect(key(calls[0])).not.toBe(key(calls[1]));
        await sendBatch('key', 'from@x.test', [mail]);
        expect(key(calls[2])).toBeUndefined();
    });

    test('counts failures per chunk', async () => {
        let count = 0;
        stubFetch(() => {
            count++;
            if (count === 1) return new Response('bad', { status: 422 });
            if (count === 2) throw new Error('offline');
            return new Response('{}');
        });
        const mails = Array.from({ length: 250 }, () => mail);
        expect(await sendBatch('key', 'from@x.test', mails)).toEqual({ sent: 50, failed: 200 });
    });
});

describe('templates', () => {
    test('confirmation email escapes the site name and url', () => {
        const email = confirmEmail('A & <B>', 'https://x.test/c?a=1&b="2"');
        expect(email.subject).toBe('Confirm your subscription to A & <B>');
        expect(email.html).toContain('A &amp; &lt;B&gt;');
        expect(email.html).toContain('https://x.test/c?a=1&amp;b=&quot;2&quot;');
        expect(email.text).toContain('https://x.test/c?a=1&b="2"');
    });

    test('unsubscribe email', () => {
        const email = unsubscribeEmail('Site', 'https://x.test/u');
        expect(email.subject).toBe('Confirm unsubscribing from Site');
        expect(email.html).toContain('href="https://x.test/u"');
        expect(email.text).toContain('https://x.test/u');
    });

    test('new post email with and without an excerpt', () => {
        const post = { title: 'T <1>', excerpt: ' About ', url: 'https://x.test/p' };
        const withExcerpt = newPostEmail('Site', post, 'https://x.test/u');
        expect(withExcerpt.subject).toBe('T <1>');
        expect(withExcerpt.html).toContain('T &lt;1&gt;');
        expect(withExcerpt.html).toContain('About');
        expect(withExcerpt.text).toContain('About');
        const bare = newPostEmail('Site', { ...post, excerpt: '  ' }, 'https://x.test/u');
        expect(bare.html).not.toContain('line-height:1.6;color:#3d443f">  ');
        const missing = newPostEmail('Site', { ...post, excerpt: null }, 'https://x.test/u');
        expect(missing.text).toContain('T <1>\n\n\n\nRead it');
    });
});

describe('contactMessageEmail', () => {
    const base = {
        kind: 'message' as const,
        name: 'Ada\nLovelace',
        email: 'ada@example.com',
        message: 'Hello <b>there</b>',
        sentAt: new Date('2026-06-15T12:00:00Z'),
        timeZone: 'Asia/Jakarta',
        site: 'https://x.test',
        reference: 'REF-1'
    };

    test('formats a contact message', () => {
        const email = contactMessageEmail(base);
        expect(email.subject).toBe('[Contact] Message from Ada Lovelace');
        expect(email.replyTo).toBe('ada@example.com');
        expect(email.html).toContain('Hello &lt;b&gt;there&lt;/b&gt;');
        expect(email.text).toContain('Type:');
        expect(email.text).toContain('Contact message');
        expect(email.text).not.toContain('Location:');
        expect(email.text).not.toContain('Page:');
    });

    test('formats a feedback report with optional details', () => {
        const email = contactMessageEmail({
            ...base,
            kind: 'feedback',
            pageUrl: 'https://x.test/blog/post',
            location: 'Jakarta, ID',
            client: 'Firefox'
        });
        expect(email.subject).toBe('[Feedback] Report on /blog/post from Ada Lovelace');
        expect(email.text).toContain('Jakarta, ID (approximate, from IP address)');
        expect(email.text).toContain('Firefox');
        expect(email.text).toContain('Feedback report');
        const relative = contactMessageEmail({ ...base, kind: 'feedback', pageUrl: '/relative' });
        expect(relative.subject).toContain('/relative');
        const feedbackWithoutPage = contactMessageEmail({ ...base, kind: 'feedback' });
        expect(feedbackWithoutPage.subject).toBe('[Contact] Message from Ada Lovelace');
    });

    test('truncates long subjects', () => {
        const email = contactMessageEmail({ ...base, name: 'x'.repeat(400) });
        expect(email.subject).toHaveLength(200);
    });
});
