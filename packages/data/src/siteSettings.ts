import type { AnalyticsSettings } from '@idstead/domain/analytics.ts';

export interface SiteSettingsRepository {
    analytics(): Promise<AnalyticsSettings>;
}

export interface SiteSettingsWriter {
    saveAnalytics(settings: AnalyticsSettings): Promise<void>;
}
