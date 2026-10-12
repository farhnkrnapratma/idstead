import { describe, expect, mock, test } from 'bun:test';

mock.module('$app/env/public', () => ({ PUBLIC_SENTRY_ENVIRONMENT: '' }));

mock.module('#lib/server/publicMetadata.ts', () => ({
    readSiteProfile: async () => ({ siteUrl: 'https://fkp.my.id' }),
    publicResponse: async (_request: Request, body: string, type: string) =>
        new Response(body, { headers: { 'Content-Type': type } })
}));

const { GET } = await import('../apps/web/src/routes/robots.txt/+server');

describe('robots.txt', () => {
    test('uses standard crawl directives and keeps the sitemap', async () => {
        const request = new Request('https://fkp.my.id/robots.txt');
        const response = await GET({ request, url: new URL(request.url) } as never);
        const body = await response.text();

        expect(response.headers.get('content-type')).toContain('text/plain');
        expect(body).toContain('User-agent: *');
        expect(body).toContain('Allow: /');
        expect(body).toContain('Disallow: /admin/');
        expect(body).toContain('Sitemap: https://fkp.my.id/sitemap.xml');
        expect(body.split('\n').filter(line => line.startsWith('Sitemap:'))).toHaveLength(1);
        expect(body).not.toContain('Agentmap:');
    });

    test('keeps preview sites blocked from crawling', async () => {
        for (const host of ['preview.pages.dev', 'fkp-web.example.workers.dev']) {
            const request = new Request(`https://${host}/robots.txt`);
            const response = await GET({ request, url: new URL(request.url) } as never);

            expect(await response.text()).toBe('User-agent: *\nDisallow: /\n');
        }
    });
});
