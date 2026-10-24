import { SITE_BANNER_HEIGHT, SITE_BANNER_WIDTH } from '#lib/blogBanner.ts';
import type { SvgPath } from '#lib/siteIdentity.ts';

const FALLBACK_LAYOUT_VERSION = 1;
export const BANNER_SAFE_WIDTH = 1040;

export type BannerFont = 'sans' | 'mono';
export type Measure = (text: string, font: BannerFont, size: number) => number;

export interface BannerSocial {
    url: string;
    platform: string;
    icon: string;
}

export interface BannerInput {
    name: string;
    siteUrl: string;
    social: BannerSocial | null;
}

type BannerSegment =
    { kind: 'text'; text: string; x: number } | { kind: 'icon'; x: number; size: number };

export interface BannerRow {
    font: BannerFont;
    bold: boolean;
    size: number;
    y: number;
    segments: BannerSegment[];
}

const handlePrefixes = new Set(['in', 'u', 'user', 'users', 'c', 'channel', 'company', 'profile']);

export function socialHandle(url: string): string | null {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    const segments = parsed.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const first = segments[0];
    if (!first) return null;
    const handle =
        first.startsWith('@') ? first.slice(1)
        : handlePrefixes.has(first.toLowerCase()) ? segments[1]
        : segments.length === 1 ? first
        : null;
    if (!handle || !/^[\p{L}\p{N}._-]{1,64}$/u.test(handle)) return null;
    return `@${handle}`;
}

function displayHost(url: string): string {
    try {
        return new URL(url).host.replace(/^www\./, '');
    } catch {
        return '';
    }
}

export function displaySiteUrl(siteUrl: string): string {
    try {
        const parsed = new URL(siteUrl);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.origin : '';
    } catch {
        return '';
    }
}

function truncate(text: string, fits: (candidate: string) => boolean): string {
    if (fits(text)) return text;
    const chars = Array.from(text);
    for (let length = chars.length - 1; length > 0; length--) {
        const candidate = `${chars.slice(0, length).join('').trimEnd()}…`;
        if (fits(candidate)) return candidate;
    }
    return '…';
}

interface RowSpec {
    font: BannerFont;
    bold: boolean;
    max: number;
    min: number;
    parts: ({ kind: 'text'; text: string } | { kind: 'icon' } | { kind: 'gap'; em: number })[];
}

function rowWidth(spec: RowSpec, size: number, measure: Measure) {
    return spec.parts.reduce(
        (sum, part) =>
            sum
            + (part.kind === 'text' ? measure(part.text, spec.font, size)
            : part.kind === 'icon' ? size
            : part.em * size),
        0
    );
}

function fitRow(spec: RowSpec, measure: Measure): { spec: RowSpec; size: number } {
    for (let size = spec.max; size >= spec.min; size--)
        if (rowWidth(spec, size, measure) <= BANNER_SAFE_WIDTH) return { spec, size };
    const size = spec.min;
    const texts = spec.parts.filter(part => part.kind === 'text');
    const longest = texts.reduce((a, b) =>
        measure(a.text, spec.font, size) >= measure(b.text, spec.font, size) ? a : b
    );
    const others = rowWidth(spec, size, measure) - measure(longest.text, spec.font, size);
    longest.text = truncate(
        longest.text,
        candidate => others + measure(candidate, spec.font, size) <= BANNER_SAFE_WIDTH
    );
    return { spec, size };
}

export function bannerLayout(input: BannerInput, measure: Measure, hasIcon: boolean): BannerRow[] {
    const name = input.name.trim();
    const site = displaySiteUrl(input.siteUrl);
    const handle = input.social ? socialHandle(input.social.url) : null;
    const socialText = input.social ? (handle ?? displayHost(input.social.url)) : '';
    const showIcon = Boolean(hasIcon && handle);
    const specs: RowSpec[] = [];
    if (!name && !socialText) {
        if (site)
            specs.push({
                font: 'sans',
                bold: true,
                max: 88,
                min: 28,
                parts: [{ kind: 'text', text: site }]
            });
    } else {
        if (name)
            specs.push({
                font: 'sans',
                bold: true,
                max: 96,
                min: 36,
                parts: [{ kind: 'text', text: name }]
            });
        const detail: RowSpec['parts'] = [];
        if (site) detail.push({ kind: 'text', text: site });
        if (socialText) {
            if (detail.length) detail.push({ kind: 'gap', em: 1.25 });
            if (showIcon) detail.push({ kind: 'icon' }, { kind: 'gap', em: 0.4 });
            detail.push({ kind: 'text', text: socialText });
        }
        if (detail.length)
            specs.push({ font: 'mono', bold: false, max: 34, min: 18, parts: detail });
    }
    const fitted = specs.map(spec => fitRow(spec, measure));
    const heights = fitted.map(({ size }) => size * 1.25);
    const gap = fitted.length > 1 ? fitted[0].size * 0.35 : 0;
    let top = (SITE_BANNER_HEIGHT - heights.reduce((a, b) => a + b, 0) - gap) / 2;
    return fitted.map(({ spec, size }, index) => {
        const y = top + heights[index] / 2;
        top += heights[index] + gap;
        let x = (SITE_BANNER_WIDTH - rowWidth(spec, size, measure)) / 2;
        const segments: BannerSegment[] = [];
        for (const part of spec.parts) {
            if (part.kind === 'text') {
                segments.push({ kind: 'text', text: part.text, x });
                x += measure(part.text, spec.font, size);
            } else if (part.kind === 'icon') {
                segments.push({ kind: 'icon', x, size });
                x += size;
            } else x += part.em * size;
        }
        return { font: spec.font, bold: spec.bold, size, y, segments };
    });
}

export function avatarSeed(name: string, profileId?: string | null): string {
    return name.trim() || profileId || crypto.randomUUID();
}

export async function fallbackFingerprint(
    kind: 'avatar' | 'banner',
    input: Record<string, unknown>
): Promise<string> {
    const bytes = new TextEncoder().encode(
        JSON.stringify({ kind, version: FALLBACK_LAYOUT_VERSION, input })
    );
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function blobatarVector(svg: string): SvgPath[] {
    const scale = (d: string) =>
        d.replace(/-?\d*\.?\d+/g, value => String(Math.round(Number(value) * 128) / 100));
    const paths: SvgPath[] = [];
    for (const match of svg.matchAll(
        /<g fill="(#[0-9a-f]{6})">(.*?)<\/g>|<path d="([^"]+)" fill="(#[0-9a-f]{6})"\/>/gi
    )) {
        if (match[1])
            for (const inner of match[2].matchAll(/<path d="([^"]+)"\/>/g))
                paths.push({ d: scale(inner[1]), fill: match[1], opacity: 1 });
        else paths.push({ d: scale(match[3]), fill: match[4], opacity: 1 });
    }
    if (!paths.length) throw new Error('Invalid generated avatar.');
    return paths;
}
