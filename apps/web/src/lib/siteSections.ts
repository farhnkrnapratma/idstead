import type { Section } from '@fkp/domain/types.ts';

export interface SiteSection {
    id: Section;
    label: string;
    path: string;
}

export const SITE_SECTIONS: SiteSection[] = [
    { id: 'home', label: 'Home', path: '/' },
    { id: 'projects', label: 'Projects', path: '/projects' },
    { id: 'blog', label: 'Blog', path: '/blog' },
    { id: 'cv', label: 'CV', path: '/cv' },
    { id: 'funding', label: 'Funding', path: '/funding' },
    { id: 'contact', label: 'Contact', path: '/contact' }
];

export function sectionPath(id: Section): string {
    return SITE_SECTIONS.find(section => section.id === id)?.path ?? '/';
}

export function sectionForPath(pathname: string): Section | null {
    if (pathname === '/') return 'home';
    const match = SITE_SECTIONS.find(
        section =>
            section.path !== '/'
            && (pathname === section.path || pathname.startsWith(`${section.path}/`))
    );
    return match?.id ?? null;
}

export function legacySectionPath(hash: string): string | null {
    const id = hash.replace(/^#/, '').toLowerCase();
    const match = SITE_SECTIONS.find(section => section.id === id && section.id !== 'home');
    return match ? match.path : null;
}
