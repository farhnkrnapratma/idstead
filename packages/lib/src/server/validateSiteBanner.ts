import { inspectAvif } from '#lib/avif.ts';
import { inspectWebp } from '#lib/webp.ts';
import { IMAGE_LIMIT, bannerSizes, type BannerAssetName } from '#lib/siteIdentity.ts';

export const identityFields = new Set<string>(['profile', 'identity', ...Object.keys(bannerSizes)]);

export type IdentitySource = 'custom' | 'generated';

export interface IdentityMeta {
    source: IdentitySource;
    fingerprint: string | null;
}

export async function validateSiteBanner(
    form: FormData
): Promise<Record<BannerAssetName, ArrayBuffer> | null> {
    const names = Object.keys(bannerSizes) as BannerAssetName[];
    const present = names.filter(name => form.getAll(name).length);
    if (!present.length) return null;
    if (names.some(name => form.getAll(name).length !== 1))
        throw new Error('Upload the complete banner package.');
    const files = {} as Record<BannerAssetName, ArrayBuffer>;
    for (const name of names) {
        const file = form.get(name);
        if (!(file instanceof File) || file.size > IMAGE_LIMIT)
            throw new Error('Invalid banner file.');
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        if (name.endsWith('.avif'))
            inspectAvif(bytes, { maxBytes: IMAGE_LIMIT, ...bannerSizes[name] });
        else inspectWebp(bytes, { maxBytes: IMAGE_LIMIT, ...bannerSizes[name] });
        files[name] = buffer;
    }
    return files;
}

function parseMeta(value: unknown): IdentityMeta {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Invalid image metadata.');
    const { source, fingerprint } = value as Record<string, unknown>;
    if (source === 'custom' && (fingerprint === null || fingerprint === undefined))
        return { source, fingerprint: null };
    if (
        source === 'generated'
        && typeof fingerprint === 'string'
        && /^[0-9a-f]{64}$/.test(fingerprint)
    )
        return { source, fingerprint };
    throw new Error('Invalid image metadata.');
}

export function parseIdentityMeta(form: FormData): { avatar: IdentityMeta; banner: IdentityMeta } {
    const entries = form.getAll('identity');
    const fallback: IdentityMeta = { source: 'custom', fingerprint: null };
    if (!entries.length) return { avatar: fallback, banner: fallback };
    const raw = entries[0];
    if (entries.length !== 1 || typeof raw !== 'string' || raw.length > 1000)
        throw new Error('Invalid image metadata.');
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error('Invalid image metadata.');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('Invalid image metadata.');
    const { avatar, banner, ...rest } = parsed as Record<string, unknown>;
    if (Object.keys(rest).length) throw new Error('Invalid image metadata.');
    return {
        avatar: avatar === undefined ? fallback : parseMeta(avatar),
        banner: banner === undefined ? fallback : parseMeta(banner)
    };
}
