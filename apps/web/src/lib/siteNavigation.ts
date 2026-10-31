// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { Component } from 'svelte';
import {
    AtSign,
    BotMessageSquare,
    FileUser,
    FolderOpen,
    HeartHandshake,
    House,
    Lock,
    Quote,
    Rss,
    ScrollText,
    ShieldUser,
    Workflow
} from '@lucide/svelte';
import { buttonKey, sectionCommandKey } from '@idstead/ui/shortcuts.ts';

export interface SiteNavLink {
    label: string;
    href: string;
    icon?: Component<{ class?: string }>;
    combo: string;
}

export interface SiteNavAction {
    label: string;
    action: 'cookies';
    combo: string;
}

export interface SiteNavGroup {
    label: string;
    items: SiteNavLink[];
}

function page(label: string, href: string, icon?: Component<{ class?: string }>): SiteNavLink {
    return { label, href, icon, combo: sectionCommandKey(href) };
}

export const PAGE_LINKS: SiteNavLink[] = [
    page('Home', '/', House),
    page('Blog', '/blog', Quote),
    page('Projects', '/projects', FolderOpen),
    page('Resume', '/resume', FileUser)
];

export const OTHER_GROUPS: SiteNavGroup[] = [
    {
        label: 'Connect',
        items: [
            { ...page('Contact', '/contact'), icon: AtSign },
            { ...page('Funding', '/funding'), icon: HeartHandshake }
        ]
    },
    {
        label: 'Legal',
        items: [
            { label: 'Terms', href: '/terms', icon: ScrollText, combo: buttonKey('termsLink') },
            {
                label: 'Privacy',
                href: '/privacy',
                icon: ShieldUser,
                combo: buttonKey('privacyLink')
            },
            { label: 'Security', href: '/security', icon: Lock, combo: buttonKey('securityLink') },
            {
                label: 'AI Disclosure',
                href: '/ai-disclosure',
                icon: BotMessageSquare,
                combo: buttonKey('aiDisclosureLink')
            }
        ]
    },
    {
        label: 'Feeds',
        items: [
            { label: 'RSS', href: '/atom.xml', icon: Rss, combo: buttonKey('feed') },
            {
                label: 'Sitemap',
                href: '/sitemap.xml',
                icon: Workflow,
                combo: buttonKey('sitemapLink')
            }
        ]
    }
];

export const COOKIES_ACTION: SiteNavAction = {
    label: 'Cookies',
    action: 'cookies',
    combo: buttonKey('cookiesLink')
};
