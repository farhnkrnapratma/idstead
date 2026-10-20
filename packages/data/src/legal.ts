export type LegalSlug = 'privacy' | 'security' | 'terms';

export interface LegalPage {
    slug: string;
    title: string;
    content: string;
    updated_at?: string;
}

export interface LegalPageRepository {
    page(slug: string): Promise<LegalPage | null>;
    pages(): Promise<LegalPage[]>;
}

export type LegalPageSave = { status: 'saved' } | { status: 'rejected'; message: string };

export interface LegalPageWriter {
    save(page: { slug: LegalSlug; title: string; content: string }): Promise<LegalPageSave>;
}
