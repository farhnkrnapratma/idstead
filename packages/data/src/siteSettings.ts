// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { AnalyticsSettings } from '@idstead/domain/analytics.ts';
import type { ContentLicenseSettings } from '@idstead/domain/contentLicense.ts';

export interface SiteSettingsRepository {
    analytics(): Promise<AnalyticsSettings>;
    contentLicense(): Promise<ContentLicenseSettings>;
}

export interface SiteSettingsWriter {
    saveAnalytics(settings: AnalyticsSettings): Promise<void>;
    saveContentLicense(settings: ContentLicenseSettings): Promise<void>;
}
