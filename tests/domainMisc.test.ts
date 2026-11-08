// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test';
import {
    AnalyticsSettingsError,
    parseAnalyticsSettings
} from '../packages/domain/src/analytics.ts';
import {
    formatMonthAbbrev,
    formatMonthFull,
    normalizeIconInput,
    parseLucideTag,
    resumeChecksumsFrom
} from '../packages/domain/src/author.ts';
import { RESUME_CHECKSUM_ALGORITHMS } from '../packages/domain/src/resumeChecksums.ts';
import { UUID_PATTERN, bannerKey } from '../packages/domain/src/blogAssets.ts';
import {
    ContentLicenseSettingsError,
    parseBannerCredit
} from '../packages/domain/src/contentLicense.ts';
import {
    FieldValidation,
    emailError,
    requiredText
} from '../packages/domain/src/fieldValidation.ts';
import {
    formatBadgeCount,
    formatCommentCount,
    formatReadTime,
    formatRelativeTime,
    formatViewCount,
    getRelativeTimeNextUpdateMs
} from '../packages/domain/src/formatters.ts';
import { hashIp, sha256Hex } from '../packages/domain/src/hash.ts';
import { InstanceConfigError, resolveInstanceConfig } from '../packages/domain/src/instance.ts';
import { safeKeyserverUrl } from '../packages/domain/src/openpgpKey.ts';
import { pageOfIndex, pageSlice } from '../packages/domain/src/pagination.ts';

describe('author month and icon helpers', () => {
    const months = [
        ['jan', 'January', 'Jan'],
        ['2', 'February', 'Feb'],
        ['Mar.', 'March', 'Mar'],
        ['04', 'April', 'Apr'],
        ['may', 'May', 'May'],
        ['june', 'June', 'Jun'],
        ['7', 'July', 'Jul'],
        ['aug', 'August', 'Aug'],
        ['09', 'September', 'Sep'],
        ['oct', 'October', 'Oct'],
        ['11', 'November', 'Nov'],
        ['december', 'December', 'Dec']
    ] as const;

    test('formats every month name, number and abbreviation', () => {
        for (const [input, full, abbrev] of months) {
            expect(formatMonthFull(input)).toBe(full);
            expect(formatMonthAbbrev(input)).toBe(abbrev);
        }
    });

    test('falls back for unknown and empty months', () => {
        expect(formatMonthFull('sEpTember2')).toBe('September2');
        expect(formatMonthAbbrev('sEpTember2')).toBe('Sep');
        for (const empty of [null, undefined, '', '  ']) {
            expect(formatMonthFull(empty)).toBe('');
            expect(formatMonthAbbrev(empty)).toBe('');
        }
    });

    test('normalizes icon input', () => {
        expect(normalizeIconInput(null)).toBe('');
        expect(normalizeIconInput('<svg/>')).toBe('<svg/>');
        expect(normalizeIconInput('Github')).toBe('<Github />');
        expect(normalizeIconInput('bi bi-x')).toBe('bi bi-x');
        expect(normalizeIconInput('bi-x')).toBe('bi bi-x');
        expect(normalizeIconInput('mail!')).toBe('bi bi-mail');
    });

    test('parses lucide tags and keeps only allowed props', () => {
        expect(
            parseLucideTag('<Mail size={20} strokeWidth="1.5" color="red" absoluteStrokeWidth />')
        ).toEqual({
            name: 'Mail',
            props: { size: 20, strokeWidth: 1.5, color: 'red', absoluteStrokeWidth: true }
        });
        expect(parseLucideTag('<Mail color={true} size={false} onclick="x" />')?.props).toEqual({
            color: true,
            size: false
        });
        expect(parseLucideTag('<123 />')).toBeNull();
    });

    test('accepts resume checksums only when every digest is hex', () => {
        expect(resumeChecksumsFrom(null)).toBeNull();
        expect(resumeChecksumsFrom('x')).toBeNull();
        expect(resumeChecksumsFrom({})).toBeNull();
        const good = Object.fromEntries(RESUME_CHECKSUM_ALGORITHMS.map(({ ext }) => [ext, 'ab12']));
        expect(resumeChecksumsFrom(good)).toEqual(good as never);
        const bad = { ...good, [RESUME_CHECKSUM_ALGORITHMS[0].ext]: 'XYZ' };
        expect(resumeChecksumsFrom(bad)).toBeNull();
    });
});

describe('analytics settings', () => {
    test('rejects malformed script URLs', () => {
        expect(() =>
            parseAnalyticsSettings({ provider: 'plausible', domain: 'a.com', scriptUrl: 'nope' })
        ).toThrow(AnalyticsSettingsError);
    });
});

describe('banner identities and credits', () => {
    test('rejects non-uuid identities', () => {
        const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
        expect(UUID_PATTERN.test(id)).toBe(true);
        expect(bannerKey(id, id, 'avif')).toBe(`blog/banners/${id}/${id}.avif`);
        expect(() => bannerKey('x', id)).toThrow('Invalid banner identity.');
        expect(() => bannerKey(id, 'x')).toThrow('Invalid banner identity.');
    });

    test('rejects non-https credit URLs and malformed credit shapes', () => {
        expect(() => parseBannerCredit([])).toThrow(ContentLicenseSettingsError);
        expect(() => parseBannerCredit('x')).toThrow(ContentLicenseSettingsError);
        for (const url of ['http://a.com', 'not a url', 'https://u:p@a.com/x']) {
            expect(() =>
                parseBannerCredit({ origin: 'third-party', author: 'A', url, license: 'CC' })
            ).toThrow(ContentLicenseSettingsError);
        }
        expect(parseBannerCredit({ origin: 'own' })).toBeNull();
        expect(() => parseBannerCredit({ origin: 'ai-generated', tool: 'a\0b' })).toThrow();
        expect(() => parseBannerCredit({ origin: 'third-party' })).toThrow(
            ContentLicenseSettingsError
        );
        expect(() => parseBannerCredit({ origin: 'other' })).toThrow(ContentLicenseSettingsError);
        expect(() =>
            parseBannerCredit({
                origin: 'third-party',
                author: 'x'.repeat(200),
                url: 'https://a.com'
            })
        ).toThrow(ContentLicenseSettingsError);
    });
});

describe('hash and pagination', () => {
    test('hashes deterministically', async () => {
        expect(await sha256Hex('a')).toBe(
            'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb'
        );
        expect(await hashIp('1.1.1.1', 's')).toBe(await sha256Hex('1.1.1.1s'));
    });

    test('slices pages and locates an index', () => {
        expect(pageSlice([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]);
        expect(pageSlice([1, 2, 3, 4, 5], 9, 2)).toEqual([5]);
        expect(pageOfIndex(0, 10)).toBe(1);
        expect(pageOfIndex(25, 10)).toBe(3);
    });
});

describe('keyserver URLs', () => {
    test('rejects URLs the parser would not echo back unchanged', () => {
        expect(safeKeyserverUrl('https://keys.openpgp.org/x')).toBe('https://keys.openpgp.org/x');
        expect(safeKeyserverUrl('https://[::')).toBeNull();
        expect(safeKeyserverUrl('https://a.com:99999999/x')).toBeNull();
        expect(safeKeyserverUrl('https://u@a.com/x')).toBeNull();
        expect(safeKeyserverUrl(5)).toBeNull();
        expect(safeKeyserverUrl('https://a.com/' + 'x'.repeat(500))).toBeNull();
    });
});

describe('formatters', () => {
    const now = new Date('2026-01-01T00:00:00Z');

    test('formats relative time across units and edge cases', () => {
        expect(formatRelativeTime(null)).toBe('');
        expect(formatRelativeTime('garbage')).toBe('');
        expect(formatRelativeTime(now, now)).toBe('1 millisecond ago');
        expect(formatRelativeTime(new Date(now.getTime() - 500), now)).toBe('500 milliseconds ago');
        expect(formatRelativeTime(new Date(now.getTime() - 1000), now)).toBe('1 second ago');
        expect(formatRelativeTime(new Date(now.getTime() - 3 * 3600_000), now)).toBe('3 hours ago');
        expect(formatRelativeTime(new Date(now.getTime() - 2 * 86400_000 * 800), now)).toBe(
            '4 years ago'
        );
    });

    test('schedules the next relative-time update', () => {
        expect(getRelativeTimeNextUpdateMs(null)).toBe(60000);
        const past = new Date(now.getTime() - 90_000);
        expect(getRelativeTimeNextUpdateMs(past, now)).toBeGreaterThanOrEqual(250);
        expect(getRelativeTimeNextUpdateMs(now, now)).toBeGreaterThanOrEqual(250);
    });

    test('formats read time and counts', () => {
        expect(formatReadTime()).toBe('1 min read');
        expect(formatReadTime(0)).toBe('1 min read');
        expect(formatReadTime(4.4)).toBe('4 min read');
        expect(formatReadTime('7 minutes')).toBe('7 min read');
        expect(formatReadTime('none')).toBe('1 min read');
        expect(formatCommentCount(1)).toBe('1 comment');
        expect(formatCommentCount()).toBe('0 comments');
        expect(formatViewCount(2)).toBe('2 views');
        expect(formatBadgeCount(150)).toBe('99+');
        expect(formatBadgeCount(null)).toBe('0');
    });
});

describe('instance config validation', () => {
    test('rejects malformed sections and values', () => {
        expect(() => resolveInstanceConfig([])).toThrow(InstanceConfigError);
        expect(() => resolveInstanceConfig({ domains: { site: 'example.org' }, jobs: 5 })).toThrow(
            'jobs must be an object.'
        );
        expect(() => resolveInstanceConfig({ domains: { site: 'Bad_Host' } })).toThrow(
            'domains.site is missing or invalid.'
        );
        expect(() =>
            resolveInstanceConfig({
                domains: { site: 'example.org' },
                cloudflare: { rateLimitNamespaces: { web: 0 } }
            })
        ).toThrow('must be a positive integer.');
        expect(() =>
            resolveInstanceConfig({ domains: { site: 'example.org', redirectWww: 'yes' } })
        ).toThrow('domains.redirectWww must be a boolean.');
    });
});

describe('FieldValidation', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    function setup(validate: (value: string) => string | Promise<string> = requiredText('Name')) {
        const state = {
            value: '',
            baseline: '',
            reports: [] as { error: string; valid: boolean }[]
        };
        const validation = new FieldValidation(10);
        validation.register('name', {
            value: () => state.value,
            baseline: () => state.baseline,
            validate,
            report: result => state.reports.push(result)
        });
        return { state, validation };
    }

    test('debounces input and caches results per signature', async () => {
        const { state, validation } = setup();
        expect(validation.check('missing')).toBe(true);
        validation.input('name');
        expect(state.reports.at(-1)).toEqual({ error: '', valid: false });
        state.value = 'x';
        validation.input('name');
        jest.advanceTimersByTime(20);
        expect(state.reports.at(-1)).toEqual({ error: '', valid: true });
        expect(validation.check('name')).toBe(true);
        expect(validation.check('name', true)).toBe(true);
        state.value = '';
        expect(await validation.submit(['name'], true)).toBe(false);
        state.baseline = '';
        state.value = '';
        validation.input('name');
        expect(validation.check('name')).toBe(true);
    });

    test('handles async, throwing and stale validators', async () => {
        const slow = setup(async value => (value === 'bad' ? 'Bad' : ''));
        slow.state.value = 'bad';
        expect(await slow.validation.check('name')).toBe(false);
        slow.state.value = 'ok';
        const pending = slow.validation.check('name') as Promise<boolean>;
        slow.state.value = 'changed';
        expect(await pending).toBe(false);

        const rejecting = setup(async () => {
            throw new Error('x');
        });
        rejecting.state.value = 'a';
        expect(await rejecting.validation.check('name')).toBe(false);
        expect(rejecting.state.reports.at(-1)?.error).toBe(
            'Validation is unavailable. Please retry.'
        );

        const throwing = setup(() => {
            throw new Error('x');
        });
        throwing.state.value = 'a';
        expect(throwing.validation.check('name')).toBe(false);
    });

    test('applies server errors, clears, resets, removes and destroys', async () => {
        const { state, validation } = setup();
        validation.serverErrors({ name: 'Taken', other: 'ignored' });
        expect(state.reports.at(-1)).toEqual({ error: 'Taken', valid: false });
        validation.clear('name');
        validation.reset();
        validation.register('b', {
            value: () => 'b',
            validate: () => '',
            report: () => {},
            dependencies: ['name']
        });
        state.value = 'v';
        expect(await validation.submit()).toBe(true);
        validation.remove('b');
        validation.destroy();
    });

    test('exposes required and email validators', () => {
        expect(requiredText('X', 3)('abcd')).toBe('X must be 3 characters or less.');
        expect(requiredText('X')('  ')).toBe('X is required.');
        expect(emailError('a@b.co')).toBe('');
        expect(emailError('nope')).toBe('Please enter a valid email address.');
        expect(emailError('')).toBe('Email is required.');
    });
});
