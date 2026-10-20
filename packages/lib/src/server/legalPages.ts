import type { LegalPageData } from '../legalDefaults';
import { publicRepositories } from './repositories';

export type { LegalPageData };

export async function getLegalPage(slug: string): Promise<LegalPageData> {
    try {
        const page = await publicRepositories().legal.page(slug);
        return page ?? { slug, title: '', content: '' };
    } catch {
        return { slug, title: '', content: '' };
    }
}
