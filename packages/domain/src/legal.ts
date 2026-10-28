export const LEGAL_SLUGS = ['privacy', 'security', 'terms', 'ai-disclosure'] as const;

export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export function isLegalSlug(value: string): value is LegalSlug {
    return (LEGAL_SLUGS as readonly string[]).includes(value);
}

export function publishedLegalSlugs(
    pages: ReadonlyArray<{ slug: string; content?: string | null }>
): LegalSlug[] {
    return LEGAL_SLUGS.filter(slug =>
        pages.some(page => page.slug === slug && (page.content ?? '').trim() !== '')
    );
}
