// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    mailingEmailError,
    parseMailingCommand,
    submitMailing
} from '../packages/lib/src/mailing.ts';

const verified = async () => 'token';

function reply(status: number, body: unknown) {
    return async () => Response.json(body, { status });
}

describe('parseMailingCommand', () => {
    test('reads subscribe and unsubscribe commands with an optional address', () => {
        expect(parseMailingCommand('/mailing subscribe ada@example.com')).toEqual({
            action: 'subscribe',
            email: 'ada@example.com'
        });
        expect(parseMailingCommand('/Mailing UNSUBSCRIBE')).toEqual({
            action: 'unsubscribe',
            email: ''
        });
    });

    test('ignores anything else', () => {
        expect(parseMailingCommand('/mailing pause ada@example.com')).toBeNull();
        expect(parseMailingCommand('hello')).toBeNull();
    });
});

describe('mailingEmailError', () => {
    test('requires an address and limits its length', () => {
        expect(mailingEmailError('   ')).toBe('Enter your email address.');
        expect(mailingEmailError(`${'a'.repeat(250)}@example.com`)).toBe(
            'Use an email address of at most 254 characters.'
        );
        expect(mailingEmailError('ada@example.com')).toBe('');
    });
});

describe('submitMailing', () => {
    test('rejects an invalid address before verification', async () => {
        await expect(submitMailing('subscribe', '', verified)).rejects.toThrow(
            'Enter your email address.'
        );
    });

    test('stops when verification gives no token', async () => {
        await expect(submitMailing('subscribe', 'ada@example.com', async () => '')).rejects.toThrow(
            'Verification failed. Please try again.'
        );
    });

    test('posts to the subscribe endpoint and returns the server message', async () => {
        const calls: Array<[string, RequestInit]> = [];
        const message = await submitMailing(
            'subscribe',
            ' ada@example.com ',
            verified,
            undefined,
            async (input, init) => {
                calls.push([input, init]);
                return Response.json({ message: 'Done.' });
            }
        );
        expect(message).toBe('Done.');
        expect(calls[0][0]).toBe('/api/internal/subscribe');
        expect(JSON.parse(String(calls[0][1].body))).toEqual({
            email: 'ada@example.com',
            turnstileToken: 'token'
        });
    });

    test('posts unsubscribe requests to their own endpoint', async () => {
        const seen: string[] = [];
        const message = await submitMailing(
            'unsubscribe',
            'ada@example.com',
            verified,
            undefined,
            async input => {
                seen.push(input);
                return Response.json({});
            }
        );
        expect(seen).toEqual(['/api/internal/subscribe/unsubscribe-request']);
        expect(message).toBe('Check your inbox for the confirmation link.');
    });

    test('surfaces the server error message, then the top-level message, then a fallback', async () => {
        await expect(
            submitMailing(
                'subscribe',
                'ada@example.com',
                verified,
                undefined,
                reply(429, { error: { message: 'Slow down.' } })
            )
        ).rejects.toThrow('Slow down.');
        await expect(
            submitMailing(
                'subscribe',
                'ada@example.com',
                verified,
                undefined,
                reply(500, { message: 'Down.' })
            )
        ).rejects.toThrow('Down.');
        await expect(
            submitMailing('unsubscribe', 'ada@example.com', verified, undefined, reply(500, {}))
        ).rejects.toThrow('Could not unsubscribe right now. Please try again.');
    });

    test('stops when the caller aborts before the request is sent', async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(
            submitMailing(
                'subscribe',
                'ada@example.com',
                verified,
                controller.signal,
                reply(200, {})
            )
        ).rejects.toThrow();
    });
});
