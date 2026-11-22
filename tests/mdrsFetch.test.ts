// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, describe, expect, mock, test } from 'bun:test';
import { fetchJson } from '../packages/lib/src/server/mdrsFetch.ts';

const realFetch = globalThis.fetch;
const URL = 'https://api.example.com/v1/analytics';

function respond(body: string, init: ResponseInit = {}) {
    const calls: [string, RequestInit | undefined][] = [];
    globalThis.fetch = mock(async (url: string, options?: RequestInit) => {
        calls.push([url, options]);
        return new Response(body, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            ...init
        });
    }) as unknown as typeof fetch;
    return calls;
}

afterEach(() => {
    globalThis.fetch = realFetch;
});

describe('fetchJson', () => {
    test('returns the parsed JSON without following redirects', async () => {
        const calls = respond('{"provider":"umami"}');
        expect(await fetchJson(URL)).toEqual({ provider: 'umami' });
        expect(calls[0][0]).toBe(URL);
        expect(calls[0][1]?.redirect).toBe('error');
        expect(new Headers(calls[0][1]?.headers).get('accept')).toBe('application/json');
    });

    test('accepts JSON media types with a suffix', async () => {
        respond('{"a":1}', { headers: { 'Content-Type': 'application/problem+json' } });
        expect(await fetchJson(URL)).toEqual({ a: 1 });
    });

    test('rejects URLs that are not https before fetching', async () => {
        const calls = respond('{}');
        await expect(fetchJson('http://api.example.com/')).rejects.toThrow('must use https');
        expect(calls).toHaveLength(0);
    });

    test('rejects unreachable hosts, error statuses and non-JSON responses', async () => {
        globalThis.fetch = mock(async () => {
            throw new TypeError('network');
        }) as unknown as typeof fetch;
        await expect(fetchJson(URL)).rejects.toThrow(`get() could not reach ${URL}`);
        respond('{}', { status: 404 });
        await expect(fetchJson(URL)).rejects.toThrow('get() received HTTP 404');
        respond('<html>', { headers: { 'Content-Type': 'text/html' } });
        await expect(fetchJson(URL)).rejects.toThrow('get() requires a JSON response');
        respond('{nope');
        await expect(fetchJson(URL)).rejects.toThrow('get() received invalid JSON');
    });

    test('rejects bodies over 256 KB', async () => {
        respond('{}', {
            headers: { 'Content-Type': 'application/json', 'Content-Length': '300000' }
        });
        await expect(fetchJson(URL)).rejects.toThrow('larger than 256 KB');
        respond(`"${'x'.repeat(256_000)}"`);
        await expect(fetchJson(URL)).rejects.toThrow('larger than 256 KB');
    });
});
