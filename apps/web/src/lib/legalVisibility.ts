import { page } from '$app/state';
import { LEGAL_SLUGS, isLegalSlug } from '@idstead/domain/legal.ts';

function publishedLegalPages(): string[] {
    return page.data.legalPages ?? [];
}

export function isHiddenLegalPath(path: string | undefined): boolean {
    if (!path) return false;
    const slug = path.replace(/^\/+/, '').split(/[/?#.\s]/)[0];
    return isLegalSlug(slug) && !publishedLegalPages().includes(slug);
}

export function hiddenLegalPaths(): string[] {
    const published = publishedLegalPages();
    return LEGAL_SLUGS.filter(slug => !published.includes(slug)).map(slug => `/${slug}`);
}
