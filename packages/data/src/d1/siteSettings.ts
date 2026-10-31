import { ANALYTICS_OFF, storedAnalyticsSettings } from '@idstead/domain/analytics.ts';
import {
    CONTENT_LICENSE_DEFAULT,
    storedContentLicenseSettings
} from '@idstead/domain/contentLicense.ts';
import type { SiteSettingsRepository, SiteSettingsWriter } from '../siteSettings';
import { DataError } from '../errors';
import type { D1Like } from './client';

type SettingKey = 'analytics' | 'contentLicense';

async function readSetting<T>(
    db: D1Like,
    key: SettingKey,
    parse: (value: unknown) => T,
    fallback: T
): Promise<T> {
    try {
        const row = await db
            .prepare('SELECT value FROM db_site_settings WHERE key = ?1')
            .bind(key)
            .first();
        return typeof row?.value === 'string' ? parse(JSON.parse(row.value)) : fallback;
    } catch (error) {
        throw new DataError(`siteSettings.${key}`, error);
    }
}

async function writeSetting(db: D1Like, key: SettingKey, operation: string, value: unknown) {
    try {
        await db
            .prepare(
                `INSERT INTO db_site_settings (key, value, updated_at)
                 VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                 ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
            )
            .bind(key, JSON.stringify(value))
            .run();
    } catch (error) {
        throw new DataError(`siteSettings.${operation}`, error);
    }
}

export function createD1SiteSettingsRepository(db: D1Like): SiteSettingsRepository {
    return {
        analytics: () => readSetting(db, 'analytics', storedAnalyticsSettings, ANALYTICS_OFF),
        contentLicense: () =>
            readSetting(db, 'contentLicense', storedContentLicenseSettings, CONTENT_LICENSE_DEFAULT)
    };
}

export function createD1SiteSettingsWriter(db: D1Like): SiteSettingsWriter {
    return {
        saveAnalytics: settings => writeSetting(db, 'analytics', 'saveAnalytics', settings),
        saveContentLicense: settings =>
            writeSetting(db, 'contentLicense', 'saveContentLicense', settings)
    };
}
