import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { InstanceConfigError, resolveInstanceConfig } from '../packages/domain/src/instance.ts';
import { renderWranglerConfigs } from '../tooling/configure.ts';

const example = Bun.JSONC.parse(
    readFileSync(new URL('../idstead.example.jsonc', import.meta.url), 'utf8')
);

describe('resolveInstanceConfig', () => {
    test('fills product defaults from the site domain alone', () => {
        const config = resolveInstanceConfig({ domains: { site: 'example.org' } });
        expect(config.domains).toEqual({
            site: 'example.org',
            admin: 'admin.example.org',
            api: 'api.example.org',
            redirectWww: true
        });
        expect(config.cloudflare.workers).toEqual({
            web: 'idstead-web',
            admin: 'idstead-admin',
            api: 'idstead-api',
            jobs: 'idstead-jobs'
        });
        expect(config.cloudflare.newsletterQueue).toBe('idstead-newsletter');
        expect(config.jobs.cron).toBe('17 3 * * *');
    });

    test('rejects invalid domains, names and queue names', () => {
        expect(() => resolveInstanceConfig({})).toThrow(InstanceConfigError);
        expect(() => resolveInstanceConfig({ domains: { site: 'https://example.org' } })).toThrow(
            'domains.site'
        );
        expect(() =>
            resolveInstanceConfig({
                domains: { site: 'example.org' },
                cloudflare: { workers: { web: 'Bad Name' } }
            })
        ).toThrow('cloudflare.workers.web');
        expect(() =>
            resolveInstanceConfig({
                domains: { site: 'example.org' },
                cloudflare: { newsletterQueue: 'letters-dlq' }
            })
        ).toThrow('must not end with -dlq');
    });
});

describe('renderWranglerConfigs', () => {
    test('renders every app from the example config', async () => {
        const rendered = await renderWranglerConfigs(resolveInstanceConfig(example));
        const byApp = Object.fromEntries(
            Object.entries(rendered).map(([file, text]) => [
                file.split('/apps/')[1].split('/')[0],
                Bun.JSONC.parse(text) as Record<string, any>
            ])
        );
        expect(byApp.web.name).toBe('idstead-web');
        expect(byApp.web.routes.map((route: { pattern: string }) => route.pattern)).toEqual([
            'example.com',
            'www.example.com'
        ]);
        expect(byApp.admin.queues.producers[0].queue).toBe('idstead-newsletter');
        expect(
            byApp.jobs.queues.consumers.map((consumer: { queue: string }) => consumer.queue)
        ).toEqual(['idstead-newsletter', 'idstead-newsletter-dlq']);
        expect(byApp.jobs.queues.consumers[0].dead_letter_queue).toBe('idstead-newsletter-dlq');
        expect(byApp.api.routes[0].pattern).toBe('api.example.com');
        for (const text of Object.values(rendered)) expect(text).not.toContain('{{');
    });

    test('leaves out the www route when the redirect is off', async () => {
        const rendered = await renderWranglerConfigs(
            resolveInstanceConfig({ domains: { site: 'example.org', redirectWww: false } })
        );
        const web = Object.entries(rendered).find(([file]) => file.includes('/apps/web/'))![1];
        expect(Bun.JSONC.parse(web)).toMatchObject({
            routes: [{ pattern: 'example.org', custom_domain: true }]
        });
    });
});
