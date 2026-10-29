import type { RouteId } from '$app/types';
import type { Section } from '@idstead/domain/types.ts';

export interface SiteSection {
    id: Section;
    label: string;
    path: string;
    routeId: RouteId;
}

export const SITE_SECTIONS: SiteSection[] = [
    { id: 'home', label: 'Home', path: '/', routeId: '/(site)' },
    { id: 'projects', label: 'Projects', path: '/projects', routeId: '/(site)/projects' },
    { id: 'blog', label: 'Blog', path: '/blog', routeId: '/(site)/blog' },
    { id: 'resume', label: 'Resume', path: '/resume', routeId: '/(site)/resume' },
    { id: 'funding', label: 'Funding', path: '/funding', routeId: '/(site)/funding' },
    { id: 'contact', label: 'Contact', path: '/contact', routeId: '/(site)/contact' }
];

export function legacySectionPath(hash: string): string | null {
    const id = hash.replace(/^#/, '').toLowerCase();
    const match = SITE_SECTIONS.find(section => section.id === id && section.id !== 'home');
    return match ? match.path : null;
}
