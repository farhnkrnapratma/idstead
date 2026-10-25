import '@fontsource/ia-writer-quattro/700.css';
import { blobatar } from 'blobatar';
import { normalizeIconInput } from '#lib/author.ts';
import { SITE_BANNER_HEIGHT, SITE_BANNER_WIDTH } from '#lib/blogBanner.ts';
import {
    bannerLayout,
    blobatarVector,
    fallbackFingerprint,
    socialHandle,
    type BannerFont,
    type BannerInput,
    type BannerSocial
} from './identityFallbackLayout';
import { processAvatar } from './processAvatar';
import { processSiteBanner, type SiteBannerOutput } from './processSiteBanner';
import type { ImagePackage } from '#lib/siteIdentity.ts';
import { themeToken } from '@idstead/ui/themeColors.ts';

const fontFamilies: Record<BannerFont, string> = {
    sans: "'iA Writer Quattro', 'Noto Sans Variable', sans-serif",
    mono: "'Lilex Variable', ui-monospace, monospace"
};

function canvasFont(font: BannerFont, size: number, bold: boolean) {
    return `${bold ? 700 : 400} ${size}px ${fontFamilies[font]}`;
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) =>
        canvas.toBlob(
            blob => (blob ? resolve(blob) : reject(new Error('Image rendering failed.'))),
            'image/png'
        )
    );
}

function context(width: number, height: number) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image rendering is unavailable in this browser.');
    return { canvas, ctx };
}

export function avatarFingerprint(seed: string) {
    return fallbackFingerprint('avatar', { seed });
}

export function bannerFingerprint(input: BannerInput) {
    return fallbackFingerprint('banner', {
        name: input.name.trim(),
        siteUrl: input.siteUrl,
        social: input.social
    });
}

export function avatarPreview(seed: string) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(blobatar(seed, { background: 'square' }))}`;
}

export async function generateAvatarPackage(
    seed: string,
    signal: AbortSignal
): Promise<ImagePackage> {
    const image = new Image();
    image.src = avatarPreview(seed);
    await image.decode();
    const { canvas, ctx } = context(512, 512);
    ctx.drawImage(image, 0, 0, 512, 512);
    const file = new File([await canvasBlob(canvas)], 'avatar.png', { type: 'image/png' });
    const output = await processAvatar(file, signal);
    return { files: output.files, paths: blobatarVector(blobatar(seed, { background: 'square' })) };
}

function iconGlyph(social: BannerSocial): string | null {
    const normalized = normalizeIconInput(social.icon);
    const slug = social.platform.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const candidates = [
        normalized.startsWith('bi ') ? normalized : '',
        slug ? `bi bi-${slug}` : ''
    ].filter(Boolean);
    for (const className of candidates) {
        const probe = document.createElement('i');
        probe.className = className;
        probe.setAttribute('aria-hidden', 'true');
        probe.style.position = 'absolute';
        probe.style.visibility = 'hidden';
        document.body.append(probe);
        const content = getComputedStyle(probe, '::before').content;
        probe.remove();
        const glyph = content.match(/^"(.)"$/u)?.[1];
        if (glyph && /\p{Co}/u.test(glyph)) return glyph;
    }
    return null;
}

export async function renderBanner(input: BannerInput): Promise<HTMLCanvasElement> {
    const glyph = input.social && socialHandle(input.social.url) ? iconGlyph(input.social) : null;
    await Promise.all([
        document.fonts.load(canvasFont('sans', 32, true)),
        document.fonts.load(canvasFont('mono', 32, false)),
        glyph ? document.fonts.load('32px bootstrap-icons', glyph) : null
    ]);
    const { canvas, ctx } = context(SITE_BANNER_WIDTH, SITE_BANNER_HEIGHT);
    const measure = (text: string, font: BannerFont, size: number) => {
        ctx.font = canvasFont(font, size, font === 'sans');
        return ctx.measureText(text).width;
    };
    const rows = bannerLayout(input, measure, Boolean(glyph));
    if (!rows.length) throw new Error('Add a site URL before generating the website banner.');
    ctx.fillStyle = themeToken('--color-canvas');
    ctx.fillRect(0, 0, SITE_BANNER_WIDTH, SITE_BANNER_HEIGHT);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    for (const row of rows) {
        ctx.fillStyle = themeToken(row.bold ? '--color-fg' : '--color-fg-secondary');
        for (const segment of row.segments) {
            if (segment.kind === 'text') {
                ctx.font = canvasFont(row.font, row.size, row.bold);
                ctx.fillText(segment.text, segment.x, row.y);
            } else if (glyph) {
                ctx.font = `${segment.size}px bootstrap-icons`;
                ctx.fillText(glyph, segment.x, row.y);
            }
        }
    }
    return canvas;
}

export async function generateBannerPackage(input: BannerInput): Promise<SiteBannerOutput> {
    const canvas = await renderBanner(input);
    const file = new File([await canvasBlob(canvas)], 'banner.png', { type: 'image/png' });
    return processSiteBanner(file);
}
