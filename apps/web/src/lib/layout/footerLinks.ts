export interface FooterSiteLinkItem {
    label: string;
    shortcut: string;
    href?: string;
    action?: 'cookies';
}

export const FOOTER_SITE_LINKS: FooterSiteLinkItem[] = [
    { label: 'Terms', href: '/terms', shortcut: 'termsLink' },
    { label: 'Privacy', href: '/privacy', shortcut: 'privacyLink' },
    { label: 'Security', href: '/security', shortcut: 'securityLink' },
    { label: 'AI Disclosure', href: '/ai-disclosure', shortcut: 'aiDisclosureLink' },
    { label: 'Cookies', action: 'cookies', shortcut: 'cookiesLink' },
    { label: 'RSS', href: '/atom.xml', shortcut: 'feed' },
    { label: 'Sitemap', href: '/sitemap.xml', shortcut: 'sitemapLink' }
];
