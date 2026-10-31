import { describe, expect, test } from 'bun:test';
import {
    createD1SiteSettingsRepository,
    createD1SiteSettingsWriter
} from '../packages/data/src/d1/siteSettings.ts';
import { d1Shim, insertRows } from './support/d1.ts';

describe('D1 site settings adapter', () => {
    test('reads no analytics as none and round-trips a saved provider', async () => {
        const { db } = d1Shim();
        const repository = createD1SiteSettingsRepository(db);
        const writer = createD1SiteSettingsWriter(db);
        expect(await repository.analytics()).toEqual({ provider: 'none' });
        await writer.saveAnalytics({
            provider: 'umami',
            websiteId: '0f8fad5b-d9cb-469f-a165-70867728950e',
            scriptUrl: 'https://cloud.umami.is/script.js'
        });
        await writer.saveAnalytics({ provider: 'ga4', measurementId: 'G-ABC123' });
        expect(await repository.analytics()).toEqual({
            provider: 'ga4',
            measurementId: 'G-ABC123'
        });
    });

    test('a stored value that fails validation reads as none', async () => {
        const { db, sqlite } = d1Shim();
        insertRows(sqlite, 'db_site_settings', [
            { key: 'analytics', value: JSON.stringify({ provider: 'ga4', measurementId: 'x' }) }
        ]);
        expect(await createD1SiteSettingsRepository(db).analytics()).toEqual({ provider: 'none' });
    });

    test('saving bumps the site cache generation', async () => {
        const { db, sqlite } = d1Shim();
        const generation = () =>
            (
                sqlite
                    .query("select gen from db_cache_generations where domain = 'site'")
                    .get() as { gen: number }
            ).gen;
        const before = generation();
        await createD1SiteSettingsWriter(db).saveAnalytics({ provider: 'none' });
        expect(generation()).toBe(before + 1);
    });

    test('the activity log accepts settings and rejects auth', () => {
        const { sqlite } = d1Shim();
        const insert = (category: string) =>
            sqlite
                .query(
                    "insert into db_activity_log (action, category, summary) values ('x', ?, 'y')"
                )
                .run(category);
        expect(() => insert('settings')).not.toThrow();
        expect(() => insert('auth')).toThrow();
    });
});
