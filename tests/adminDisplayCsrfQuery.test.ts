// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { ADMIN_DATE_FORMATS, parseAdminDisplayPrefs } from '../packages/lib/src/adminDateFormat.ts';
import { activityLogQuery } from '../packages/lib/src/server/activityLogQuery.ts';
import { csrfHandle, isForbiddenCrossSiteForm } from '../packages/lib/src/server/csrf.ts';

describe('activity log query dates and paging', () => {
    test('normalises valid dates and rejects malformed or reversed ranges', () => {
        const query = activityLogQuery(new URLSearchParams('from=2026-01-01&to=2026-02-01'));
        expect(query.from).toBe(new Date('2026-01-01').toISOString());
        expect(() => activityLogQuery(new URLSearchParams('from=2026-13-40'))).toThrow(
            'Invalid from date.'
        );
        expect(() => activityLogQuery(new URLSearchParams('to=2026-02-30'))).toThrow(
            'Invalid to date.'
        );
        expect(() =>
            activityLogQuery(new URLSearchParams('from=2026-02-01&to=2026-01-01'))
        ).toThrow('Invalid date range.');
    });

    test('rejects paging values outside their limits', () => {
        expect(() => activityLogQuery(new URLSearchParams('limit=0'))).toThrow('Invalid limit.');
        expect(() => activityLogQuery(new URLSearchParams('offset=-1'))).toThrow('Invalid offset.');
        expect(() => activityLogQuery(new URLSearchParams('direction=up'))).toThrow(
            'Invalid sort direction.'
        );
        expect(() => activityLogQuery(new URLSearchParams('sort=secret'))).toThrow(
            'Invalid sort field.'
        );
    });
});

describe('admin display preferences', () => {
    test('keeps known values and drops the rest', () => {
        const dateFormat = ADMIN_DATE_FORMATS[0];
        expect(
            parseAdminDisplayPrefs(
                JSON.stringify({ mode: 'relative', dateFormat, timeFormat: 'not-a-format' })
            )
        ).toEqual({ mode: 'relative', dateFormat });
        expect(parseAdminDisplayPrefs('{broken')).toEqual({});
        expect(parseAdminDisplayPrefs('"text"')).toEqual({});
        expect(parseAdminDisplayPrefs(null)).toEqual({});
    });
});

describe('cross-site form protection', () => {
    const url = new URL('https://admin.example.com/api/internal/admin/posts');

    test('blocks cross-origin form posts but not reads or JSON bodies', () => {
        const form = (origin: string, type = 'application/x-www-form-urlencoded') =>
            new Request(url, { method: 'POST', headers: { origin, 'content-type': type } });
        expect(isForbiddenCrossSiteForm(form('https://evil.example'), url)).toBe(true);
        expect(isForbiddenCrossSiteForm(form(url.origin), url)).toBe(false);
        expect(
            isForbiddenCrossSiteForm(form('https://evil.example', 'application/json'), url)
        ).toBe(false);
        expect(
            isForbiddenCrossSiteForm(
                new Request(url, { headers: { origin: 'https://evil.example' } }),
                url
            )
        ).toBe(false);
    });

    test('answers blocked forms in the format the client asks for', async () => {
        const blocked = (accept: string) =>
            csrfHandle({
                event: {
                    url,
                    request: new Request(url, {
                        method: 'POST',
                        headers: {
                            origin: 'https://evil.example',
                            'content-type': 'multipart/form-data',
                            accept
                        }
                    })
                },
                resolve: async () => new Response('ok')
            } as never);
        const json = await blocked('application/json');
        expect(json.status).toBe(403);
        expect(await json.json()).toMatchObject({ message: expect.stringContaining('forbidden') });
        const text = await blocked('text/html');
        expect(text.status).toBe(403);
        expect(text.headers.get('content-type')).toContain('text/plain');
    });
});
