// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { formatMailDate, isValidTimeZone } from '../packages/domain/src/formatters.ts';
import { describeUserAgent } from '../packages/domain/src/userAgent.ts';

describe('formatMailDate', () => {
    const sent = new Date('2026-02-12T13:30:54Z');

    test('writes the full date, time and offset in the given time zone', () => {
        expect(formatMailDate(sent, 'Asia/Jakarta')).toBe(
            'Thursday February 12, 2026 20:30:54 GMT+0700'
        );
    });

    test('keeps half-hour and negative offsets', () => {
        expect(formatMailDate(sent, 'Asia/Kolkata')).toBe(
            'Thursday February 12, 2026 19:00:54 GMT+0530'
        );
        expect(formatMailDate(sent, 'America/New_York')).toBe(
            'Thursday February 12, 2026 08:30:54 GMT-0500'
        );
    });

    test('writes UTC as GMT+0000 and uses midnight as 00', () => {
        expect(formatMailDate(new Date('2026-02-12T00:05:09Z'), 'UTC')).toBe(
            'Thursday February 12, 2026 00:05:09 GMT+0000'
        );
    });
});

describe('isValidTimeZone', () => {
    test('accepts IANA zones and rejects anything else', () => {
        expect(isValidTimeZone('Asia/Jakarta')).toBe(true);
        expect(isValidTimeZone('UTC')).toBe(true);
        expect(isValidTimeZone('Mars/Olympus')).toBe(false);
        expect(isValidTimeZone('')).toBe(false);
        expect(isValidTimeZone('Asia/Jakarta\nBcc: x')).toBe(false);
        expect(isValidTimeZone('A'.repeat(65))).toBe(false);
    });
});

describe('describeUserAgent', () => {
    test.each([
        [
            'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
            'Firefox 132 on Linux'
        ],
        [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.92 Safari/537.36',
            'Chrome 130 on Windows'
        ],
        [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.2849.68',
            'Edge 130 on Windows'
        ],
        [
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0',
            'Opera 115 on macOS'
        ],
        [
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
            'Safari 18 on iOS'
        ],
        [
            'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
            'Safari 18 on iPadOS'
        ],
        [
            'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
            'Chrome 130 on Android'
        ],
        [
            'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            'Chrome 130 on ChromeOS'
        ]
    ])('%s', (agent, expected) => {
        expect(describeUserAgent(agent)).toBe(expected);
    });

    test('names the system alone when the browser is unknown, and returns null for nothing', () => {
        expect(describeUserAgent('curl/8.10.1')).toBeNull();
        expect(describeUserAgent('SomeBot/1.0 (Linux)')).toBe('Unknown browser on Linux');
        expect(describeUserAgent('')).toBeNull();
        expect(describeUserAgent(null)).toBeNull();
    });
});
