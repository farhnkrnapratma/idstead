// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    bannerCreditNotice,
    ContentLicenseSettingsError,
    contentLicense,
    licenseNotice,
    parseBannerCredit,
    parseContentLicenseSettings,
    resolvePostLicense,
    storedBannerCredit,
    storedContentLicenseSettings,
    storedPostLicense
} from '../packages/domain/src/contentLicense.ts';
import { bannerCreditForm, bannerCreditPayload } from '../apps/admin/src/lib/postLicense.ts';

describe('content license settings', () => {
    test('accepts a known license and rejects anything else', () => {
        expect(parseContentLicenseSettings({ license: 'CC-BY-NC-ND-4.0' })).toEqual({
            license: 'CC-BY-NC-ND-4.0'
        });
        for (const input of [null, [], {}, { license: 'GPL-3.0' }, { license: 'cc-by-4.0' }])
            expect(() => parseContentLicenseSettings(input)).toThrow(ContentLicenseSettingsError);
    });

    test('a missing or invalid stored setting falls back to all rights reserved', () => {
        expect(storedContentLicenseSettings(undefined)).toEqual({ license: 'all-rights-reserved' });
        expect(storedContentLicenseSettings({ license: 'MIT' })).toEqual({
            license: 'all-rights-reserved'
        });
    });

    test('a post license overrides the site license', () => {
        const site = { license: 'CC-BY-NC-ND-4.0' as const };
        expect(resolvePostLicense(null, site)).toMatchObject({
            id: 'CC-BY-NC-ND-4.0',
            label: 'CC BY-NC-ND 4.0',
            url: 'https://creativecommons.org/licenses/by-nc-nd/4.0/'
        });
        expect(resolvePostLicense('all-rights-reserved', site)).toMatchObject({
            id: 'all-rights-reserved',
            url: null
        });
        expect(storedPostLicense('CC0-1.0')).toBe('CC0-1.0');
        expect(storedPostLicense('nope')).toBeNull();
    });

    test('the notice links Creative Commons licenses and reserves the rest', () => {
        expect(licenseNotice(contentLicense('CC-BY-4.0'))).toBe(
            'Except where otherwise noted, licensed under CC BY 4.0: https://creativecommons.org/licenses/by/4.0/'
        );
        expect(licenseNotice(contentLicense('all-rights-reserved'))).toBe('All rights reserved.');
    });
});

describe('banner credit', () => {
    test('own work needs no credit', () => {
        expect(parseBannerCredit(null)).toBeNull();
        expect(parseBannerCredit({ origin: 'own', author: 'ignored' })).toBeNull();
        expect(bannerCreditNotice(null)).toBeNull();
    });

    test('a third-party banner names its creator and keeps its own license', () => {
        const credit = parseBannerCredit({
            origin: 'third-party',
            author: '  Ada Lovelace ',
            url: 'https://example.com/photo',
            license: 'Unsplash License'
        });
        expect(credit).toEqual({
            origin: 'third-party',
            author: 'Ada Lovelace',
            url: 'https://example.com/photo',
            license: 'Unsplash License'
        });
        expect(bannerCreditNotice(credit)).toBe(
            'Banner: Ada Lovelace (https://example.com/photo), Unsplash License.'
        );
    });

    test('a third-party banner without a creator or with an unsafe URL is rejected', () => {
        const fields = (input: Record<string, unknown>) => {
            try {
                parseBannerCredit({ origin: 'third-party', author: 'Ada', ...input });
                return null;
            } catch (error) {
                return (error as ContentLicenseSettingsError).field;
            }
        };
        expect(fields({ author: ' ' })).toBe('bannerCreditAuthor');
        expect(fields({ url: 'javascript:alert(1)' })).toBe('bannerCreditUrl');
        expect(fields({ url: 'http://example.com' })).toBe('bannerCreditUrl');
        expect(fields({ url: 'https://user:pass@example.com' })).toBe('bannerCreditUrl');
        expect(fields({ license: 'x'.repeat(61) })).toBe('bannerCreditLicense');
        expect(() => parseBannerCredit({ origin: 'stock' })).toThrow(ContentLicenseSettingsError);
    });

    test('an AI-generated banner claims no license', () => {
        const credit = parseBannerCredit({ origin: 'ai-generated', tool: 'Image model' });
        expect(bannerCreditNotice(credit)).toBe(
            'Banner: AI-generated image (Image model); no license claimed.'
        );
    });

    test('stored credits that fail validation read as own work', () => {
        expect(storedBannerCredit('{"origin":"third-party"}')).toBeNull();
        expect(storedBannerCredit('not json')).toBeNull();
        expect(storedBannerCredit('{"origin":"ai-generated","tool":null}')).toEqual({
            origin: 'ai-generated',
            tool: null
        });
    });

    test('the editor form round-trips every origin', () => {
        for (const credit of [
            null,
            { origin: 'third-party' as const, author: 'Ada', url: null, license: null },
            { origin: 'ai-generated' as const, tool: 'Image model' }
        ])
            expect(parseBannerCredit(bannerCreditPayload(bannerCreditForm(credit)))).toEqual(
                credit
            );
    });
});
