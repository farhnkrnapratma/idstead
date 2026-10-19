import { describe, expect, test } from 'bun:test';
import { blobatar } from 'blobatar';
import {
    BANNER_SAFE_WIDTH,
    avatarSeed,
    bannerLayout,
    blobatarVector,
    displaySiteUrl,
    fallbackFingerprint,
    socialHandle,
    type BannerInput,
    type Measure
} from '../apps/admin/src/lib/identityFallbackLayout.ts';
import { buildSvg } from '../packages/lib/src/siteIdentity.ts';

const measure: Measure = (text, font, size) =>
    Array.from(text).length * size * (font === 'mono' ? 0.6 : 0.58);

function rowWidth(row: ReturnType<typeof bannerLayout>[number]) {
    const last = row.segments.at(-1)!;
    const end =
        last.kind === 'icon' ? last.x + last.size : last.x + measure(last.text, row.font, row.size);
    return end - row.segments[0].x;
}

const github = { url: 'https://github.com/john_doe', platform: 'GitHub', icon: 'bi bi-github' };

describe('socialHandle', () => {
    test.each([
        ['https://github.com/john_doe', '@john_doe'],
        ['https://x.com/johndoe/', '@johndoe'],
        ['https://www.linkedin.com/in/john-doe', '@john-doe'],
        ['https://mastodon.social/@john', '@john'],
        ['https://www.youtube.com/@channel', '@channel'],
        ['https://example.com/a/b', null],
        ['https://example.com/', null],
        ['javascript:alert(1)', null],
        ['not a url', null],
        ['https://github.com/<script>', null]
    ])('%s → %s', (url, handle) => {
        expect(socialHandle(url)).toBe(handle);
    });
});

describe('displaySiteUrl', () => {
    test('keeps only an http(s) origin', () => {
        expect(displaySiteUrl('https://example.com/')).toBe('https://example.com');
        expect(displaySiteUrl('ftp://example.com')).toBe('');
        expect(displaySiteUrl('')).toBe('');
    });
});

describe('bannerLayout', () => {
    const cases: [string, BannerInput, boolean][] = [
        ['full', { name: 'John Doe', siteUrl: 'https://example.com', social: github }, true],
        ['no icon', { name: 'John Doe', siteUrl: 'https://example.com', social: github }, false],
        [
            'long name',
            { name: 'Pratama '.repeat(40), siteUrl: 'https://example.com', social: github },
            true
        ],
        [
            'long url',
            {
                name: 'John Doe',
                siteUrl: `https://${'sub.'.repeat(60)}example.com`,
                social: { ...github, url: `https://github.com/${'x'.repeat(60)}` }
            },
            true
        ],
        ['url only', { name: '', siteUrl: 'https://example.com', social: null }, false],
        ['name only', { name: 'John Doe', siteUrl: '', social: null }, false]
    ];

    test.each(cases)('%s stays inside the safe area', (_, input, hasIcon) => {
        const rows = bannerLayout(input, measure, hasIcon);
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
            expect(rowWidth(row)).toBeLessThanOrEqual(BANNER_SAFE_WIDTH + 0.001);
            expect(row.segments[0].x).toBeGreaterThanOrEqual(
                (1280 - BANNER_SAFE_WIDTH) / 2 - 0.001
            );
            expect(row.y - row.size / 2).toBeGreaterThan(0);
            expect(row.y + row.size / 2).toBeLessThan(640);
        }
    });

    test('empty name and social show only the site URL in bold sans', () => {
        const rows = bannerLayout(
            { name: '', siteUrl: 'https://example.com/', social: null },
            measure,
            false
        );
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ font: 'sans', bold: true });
        expect(rows[0].segments).toEqual([
            expect.objectContaining({ kind: 'text', text: 'https://example.com' })
        ]);
    });

    test('name row is sans bold and detail row is mono regular with the icon', () => {
        const [name, detail] = bannerLayout(
            { name: 'John Doe', siteUrl: 'https://example.com', social: github },
            measure,
            true
        );
        expect(name).toMatchObject({ font: 'sans', bold: true });
        expect(detail).toMatchObject({ font: 'mono', bold: false });
        expect(detail.segments.map(segment => segment.kind)).toEqual(['text', 'icon', 'text']);
        expect(detail.segments.at(-1)).toMatchObject({ text: '@john_doe' });
    });

    test('social without a handle falls back to its host without an icon', () => {
        const [, detail] = bannerLayout(
            {
                name: 'John Doe',
                siteUrl: 'https://example.com',
                social: { url: 'https://www.example.org/a/b', platform: 'Blog', icon: '' }
            },
            measure,
            true
        );
        expect(detail.segments.map(segment => segment.kind)).toEqual(['text', 'text']);
        expect(detail.segments.at(-1)).toMatchObject({ text: 'example.org' });
    });

    test('nothing to show yields no rows', () => {
        expect(bannerLayout({ name: '', siteUrl: '', social: null }, measure, false)).toEqual([]);
    });
});

describe('fingerprints and seeds', () => {
    test('fingerprints are stable and input-sensitive', async () => {
        const a = await fallbackFingerprint('banner', { name: 'John' });
        expect(a).toMatch(/^[0-9a-f]{64}$/);
        expect(await fallbackFingerprint('banner', { name: 'John' })).toBe(a);
        expect(await fallbackFingerprint('banner', { name: 'Jane' })).not.toBe(a);
        expect(await fallbackFingerprint('avatar', { name: 'John' })).not.toBe(a);
    });

    test('avatar seed prefers the name, then the profile id', () => {
        expect(avatarSeed('  John  ', 'id-1')).toBe('John');
        expect(avatarSeed('', 'id-1')).toBe('id-1');
        expect(avatarSeed('', null)).toMatch(/^[0-9a-f-]{36}$/);
    });
});

describe('blobatarVector', () => {
    test.each(['John Doe', 'x', 'Farhan Kurnia Pratama'])(
        '%s converts to a valid favicon vector',
        seed => {
            const paths = blobatarVector(blobatar(seed, { background: 'square' }));
            expect(paths.length).toBeGreaterThan(1);
            const svg = buildSvg(paths);
            expect(svg).toContain('viewBox="0 0 128 128"');
            expect(svg).not.toMatch(/<script|on\w+=/i);
        }
    );
});
