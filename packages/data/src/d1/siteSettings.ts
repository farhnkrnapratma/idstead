import { ANALYTICS_OFF, storedAnalyticsSettings } from '@idstead/domain/analytics.ts';
import type { SiteSettingsRepository, SiteSettingsWriter } from '../siteSettings';
import { DataError } from '../errors';
import type { D1Like } from './client';

export function createD1SiteSettingsRepository(db: D1Like): SiteSettingsRepository {
    return {
        async analytics() {
            try {
                const row = await db
                    .prepare("SELECT value FROM db_site_settings WHERE key = 'analytics'")
                    .first();
                return typeof row?.value === 'string' ?
                        storedAnalyticsSettings(JSON.parse(row.value))
                    :   ANALYTICS_OFF;
            } catch (error) {
                throw new DataError('siteSettings.analytics', error);
            }
        }
    };
}

export function createD1SiteSettingsWriter(db: D1Like): SiteSettingsWriter {
    return {
        async saveAnalytics(settings) {
            try {
                await db
                    .prepare(
                        `INSERT INTO db_site_settings (key, value, updated_at)
                         VALUES ('analytics', ?1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
                    )
                    .bind(JSON.stringify(settings))
                    .run();
            } catch (error) {
                throw new DataError('siteSettings.saveAnalytics', error);
            }
        }
    };
}
