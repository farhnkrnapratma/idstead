// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { env } from 'cloudflare:workers';
import {
    MAX_REQUESTS_PER_WINDOW,
    RATE_LIMIT_WINDOW_MS,
    checkRateLimit,
    clientIp
} from '../packages/lib/src/server/rateLimit.ts';

const bindings = () => env as unknown as Record<string, unknown>;

afterEach(() => {
    delete bindings().API_RATE_LIMITER;
});

describe('clientIp', () => {
    const request = (headers: Record<string, string> = {}) =>
        new Request('https://example.com', { headers });

    test('prefers the Cloudflare header, then the forwarded address', () => {
        expect(
            clientIp(request({ 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }))
        ).toBe('1.1.1.1');
        expect(clientIp(request({ 'x-forwarded-for': ' 2.2.2.2 , 3.3.3.3' }))).toBe('2.2.2.2');
    });

    test('falls back to the caller address and then to loopback', () => {
        expect(clientIp(request(), () => '4.4.4.4')).toBe('4.4.4.4');
        expect(clientIp(request())).toBe('127.0.0.1');
        expect(
            clientIp(request(), () => {
                throw new Error('no address');
            })
        ).toBe('127.0.0.1');
    });
});

describe('checkRateLimit', () => {
    test('counts requests per key and limits after the window quota', async () => {
        const first = await checkRateLimit('window-a');
        expect(first.limited).toBe(false);
        expect(first.headers['X-RateLimit-Remaining']).toBe(String(MAX_REQUESTS_PER_WINDOW - 1));
        for (let count = 1; count < MAX_REQUESTS_PER_WINDOW; count++)
            await checkRateLimit('window-a');
        const limited = await checkRateLimit('window-a');
        expect(limited.limited).toBe(true);
        expect(limited.headers['X-RateLimit-Remaining']).toBe('0');
        expect(Number(limited.headers['Retry-After'])).toBeGreaterThan(0);
        expect((await checkRateLimit('window-b')).limited).toBe(false);
    });

    test('forgets keys once their window has passed', async () => {
        const now = spyOn(Date, 'now');
        now.mockReturnValue(1_000_000);
        for (let count = 0; count < MAX_REQUESTS_PER_WINDOW; count++)
            await checkRateLimit('window-c');
        expect((await checkRateLimit('window-c')).limited).toBe(true);
        now.mockReturnValue(1_000_000 + RATE_LIMIT_WINDOW_MS + 1);
        expect((await checkRateLimit('window-c')).limited).toBe(false);
        now.mockRestore();
    });

    test('evicts the oldest key when too many are tracked', async () => {
        for (let index = 0; index < 10_001; index++) await checkRateLimit(`flood-${index}`);
        expect((await checkRateLimit('flood-new')).limited).toBe(false);
    }, 60_000);

    test('defers to the Workers rate limiter binding when present', async () => {
        const decisions: boolean[] = [true, false];
        bindings().API_RATE_LIMITER = {
            limit: async () => ({ success: decisions.shift() as boolean })
        };
        expect((await checkRateLimit('binding-key')).limited).toBe(false);
        const limited = await checkRateLimit('binding-key');
        expect(limited.limited).toBe(true);
        expect(limited.headers['Retry-After']).toBe(String(RATE_LIMIT_WINDOW_MS / 1000));
    });
});
