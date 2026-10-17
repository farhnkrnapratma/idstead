import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { unsubscribeResultUrl } from '../packages/lib/src/server/unsubscribeUrl';

const unsubscribePageServer = readFileSync(
    new URL('../apps/web/src/routes/unsubscribe/+page.server.ts', import.meta.url),
    'utf8'
);
const subscribeHandler = readFileSync(
    new URL('../apps/web/src/routes/api/internal/subscribe/+server.ts', import.meta.url),
    'utf8'
);

describe('unsubscribe result URL', () => {
    test('removes every bearer token before the result page can load analytics', () => {
        const url = unsubscribeResultUrl(
            new URL('https://fkp.my.id/unsubscribe?token=first&campaign=email&token=second#status'),
            'unsubscribed'
        );

        expect(url).toBe('/unsubscribe?campaign=email&state=unsubscribed#status');
        expect(url).not.toContain('token');
    });

    test('redirects token-bearing requests before rendering the analytics shell', () => {
        expect(unsubscribePageServer).toContain("const hasToken = url.searchParams.has('token')");
        expect(unsubscribePageServer).toContain(".eq('unsubscribe_token', token)");
        expect(unsubscribePageServer).toContain('redirect(303, unsubscribeResultUrl(url, state))');
    });

    test('only unsubscribes from a form POST, never while loading the page', () => {
        const [loadSource, actionSource] = unsubscribePageServer.split('export const actions');
        expect(actionSource).toBeDefined();
        expect(loadSource).not.toContain('.update(');
        expect(actionSource).toContain("status: 'unsubscribed'");
        expect(loadSource).toContain('httpOnly: true');
    });

    test('rotates an old unsubscribe token when an address resubscribes', () => {
        expect(subscribeHandler).toMatch(
            /existing\?\.status === 'unsubscribed'[\s\S]*?unsubscribe_token: createToken\(\)/
        );
    });
});
