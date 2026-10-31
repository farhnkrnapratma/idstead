// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    InstanceConfigError,
    instanceVariables,
    resolveInstanceConfig
} from '../packages/domain/src/instance.ts';
import { renderWranglerConfigs } from '../tooling/configure.ts';

const example = Bun.JSONC.parse(
    await Bun.file(new URL('../idstead.example.jsonc', import.meta.url)).text()
) as Record<string, Record<string, unknown>>;

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
        expect(config.jobs).toEqual({ cron: '17 3 * * *', hourlyCron: '37 * * * *' });
    });

    test('defaults the database name and validates its ID', () => {
        const config = resolveInstanceConfig({ domains: { site: 'example.org' } });
        expect(config.cloudflare.database).toEqual({ name: 'idstead', id: null });
        expect(() =>
            resolveInstanceConfig({
                domains: { site: 'example.org' },
                cloudflare: { database: { id: 'not-a-uuid' } }
            })
        ).toThrow('cloudflare.database.id');
    });

    test('reads optional Cloudflare Access settings for the admin', () => {
        expect(resolveInstanceConfig({ domains: { site: 'example.org' } }).access).toBeNull();
        const aud = 'b'.repeat(64);
        expect(
            resolveInstanceConfig({
                domains: { site: 'example.org' },
                access: { teamDomain: 'example.cloudflareaccess.com', aud }
            }).access
        ).toEqual({ teamDomain: 'example.cloudflareaccess.com', aud });
        expect(() =>
            resolveInstanceConfig({
                domains: { site: 'example.org' },
                access: { teamDomain: 'login.example.org', aud }
            })
        ).toThrow('access.teamDomain');
        expect(() =>
            resolveInstanceConfig({
                domains: { site: 'example.org' },
                access: { teamDomain: 'example.cloudflareaccess.com', aud: 'nope' }
            })
        ).toThrow('access.aud');
    });

    test('rejects an hourly schedule equal to the daily one', () => {
        expect(() =>
            resolveInstanceConfig({
                domains: { site: 'example.org' },
                jobs: { cron: '0 * * * *', hourlyCron: '0 * * * *' }
            })
        ).toThrow('jobs.hourlyCron');
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
        expect(byApp.web.d1_databases).toEqual([]);
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

    test('binds the D1 database to every Worker once its ID is set', async () => {
        const id = '01234567-89ab-4cde-8f01-23456789abcd';
        const rendered = await renderWranglerConfigs(
            resolveInstanceConfig({
                ...example,
                cloudflare: { ...example.cloudflare, database: { name: 'site-db', id } }
            })
        );
        for (const text of Object.values(rendered))
            expect((Bun.JSONC.parse(text) as Record<string, any>).d1_databases).toEqual([
                {
                    binding: 'DB',
                    database_name: 'site-db',
                    database_id: id,
                    migrations_dir: '../../packages/data/d1/migrations'
                }
            ]);
    });

    test('source is an optional https URL rendered for the web Worker', () => {
        expect(resolveInstanceConfig({ domains: { site: 'example.org' } }).source).toBeNull();
        const config = resolveInstanceConfig({
            domains: { site: 'example.org' },
            source: 'https://git.example.org/site'
        });
        expect(config.source).toBe('https://git.example.org/site');
        expect(instanceVariables(config).source).toBe('https://git.example.org/site');
        expect(() =>
            resolveInstanceConfig({ domains: { site: 'example.org' }, source: 'http://x.org' })
        ).toThrow('source');
        expect(() =>
            resolveInstanceConfig({ domains: { site: 'example.org' }, source: 42 })
        ).toThrow('source');
    });
});
