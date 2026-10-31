// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { unsubscribeResultUrl } from '../packages/lib/src/server/unsubscribeUrl';

const unsubscribePageServer = await Bun.file(
    new URL('../apps/web/src/routes/unsubscribe/+page.server.ts', import.meta.url)
).text();

describe('unsubscribe result URL', () => {
    test('removes every bearer token before the result page can load analytics', () => {
        const url = unsubscribeResultUrl(
            new URL(
                'https://example.com/unsubscribe?token=first&campaign=email&token=second#status'
            ),
            'unsubscribed'
        );

        expect(url).toBe('/unsubscribe?campaign=email&state=unsubscribed#status');
        expect(url).not.toContain('token');
    });

    test('redirects token-bearing requests before rendering the analytics shell', () => {
        expect(unsubscribePageServer).toContain("const hasToken = url.searchParams.has('token')");
        expect(unsubscribePageServer).toContain('subscribers.statusByUnsubscribeToken(token)');
        expect(unsubscribePageServer).toContain('redirect(303, unsubscribeResultUrl(url, state))');
    });

    test('only unsubscribes from a form POST, never while loading the page', () => {
        const [loadSource, actionSource] = unsubscribePageServer.split('export const actions');
        expect(actionSource).toBeDefined();
        expect(loadSource).not.toContain('.unsubscribe(');
        expect(actionSource).toContain('subscribers.unsubscribe(token)');
        expect(loadSource).toContain('httpOnly: true');
    });
});
