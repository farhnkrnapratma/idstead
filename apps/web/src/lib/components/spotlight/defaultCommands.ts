import { apiUrl } from '#lib/apiConfig.ts';
import * as publicEnv from '$app/env/public';

import { page } from '$app/state';
import { consentStore } from '../../stores/consentStore.svelte';
import { readingModeStore } from '@fkp/ui/stores/readingModeStore.svelte.ts';
import { shortcutStore } from '@fkp/ui/stores/shortcutStore.svelte.ts';
import { toastStore } from '@fkp/ui/stores/toastStore.svelte.ts';
import { scrollToTop, scrollToBottom } from '@fkp/ui/utils/scroll.ts';
import {
    Mail,
    RotateCw,
    SunMoon,
    Copy,
    HeartHandshake,
    House,
    FolderOpen,
    FileUser,
    Rss,
    CodeXml,
    LogOut,
    CaseSensitive,
    BookOpenText,
    Save,
    Printer,
    Cookie,
    MoveUp,
    MoveDown,
    MoveLeft,
    MoveRight,
    Braces,
    Share2,
    QrCode,
    Keyboard,
    HelpCircle,
    Quote,
    MessageSquareWarning,
    ScrollText,
    ShieldUser,
    Lock,
    AtSign,
    Workflow,
    Bot,
    PersonStanding,
    Rocket
} from '@lucide/svelte';
import type { SpotlightItem } from './types';
import type { SpotlightCommandContext } from './context';

export function createDefaultCommands(ctx: SpotlightCommandContext): SpotlightItem[] {
    const defaultCommands: SpotlightItem[] = [
        {
            id: 'cmd-home',
            category: 'pages',
            title: '/home',
            subtitle: 'Navigate to the home page.',
            url: '/',
            icon: House,
            badge: 'Page'
        },
        {
            id: 'cmd-projects',
            category: 'pages',
            title: '/projects',
            subtitle: 'Browse featured projects and repositories.',
            url: '/projects',
            icon: FolderOpen,
            badge: 'Section'
        },
        {
            id: 'cmd-blog',
            category: 'pages',
            title: '/blog',
            subtitle: 'View published blog articles and posts.',
            url: '/blog',
            icon: Quote,
            badge: 'Section'
        },
        {
            id: 'cmd-cv',
            category: 'pages',
            title: '/cv',
            subtitle: 'View curriculum vitae and work experience.',
            url: '/cv',
            icon: FileUser,
            badge: 'Section'
        },
        {
            id: 'cmd-funding',
            category: 'pages',
            title: '/funding',
            subtitle: 'Support open source work and development.',
            url: '/funding',
            icon: HeartHandshake,
            badge: 'Section'
        },
        {
            id: 'cmd-contact',
            category: 'pages',
            title: '/contact',
            subtitle: 'Send a message or contact details.',
            url: '/contact',
            icon: AtSign,
            badge: 'Section'
        },
        {
            id: 'cmd-privacy',
            category: 'pages',
            title: '/privacy',
            subtitle: 'Read privacy policy and data practices.',
            url: '/privacy',
            icon: ShieldUser,
            badge: 'Legal'
        },
        {
            id: 'cmd-terms',
            category: 'pages',
            title: '/terms',
            subtitle: 'Read terms and conditions agreement.',
            url: '/terms',
            icon: ScrollText,
            badge: 'Legal'
        },
        {
            id: 'cmd-security',
            category: 'pages',
            title: '/security',
            subtitle: 'View security policy and vulnerability guidelines.',
            url: '/security',
            icon: Lock,
            badge: 'Security'
        },
        {
            id: 'cmd-feedback',
            category: 'pages',
            title: '/feedback',
            subtitle: 'Send feedback or report an issue.',
            url: '/feedback',
            icon: MessageSquareWarning,
            badge: 'Help'
        },
        {
            id: 'cmd-goto',
            category: 'actions',
            title: '/goto',
            subtitle: 'Jump to specific page, section, or post.',
            requiresArgs: true,
            autocompleteQuery: '/goto ',
            icon: Rocket,
            badge: 'Navigation'
        },
        {
            id: 'cmd-refresh',
            category: 'actions',
            title: '/refresh',
            subtitle: 'Reload the current web page.',
            action: () => {
                if (typeof window !== 'undefined') {
                    window.location.reload();
                }
            },
            icon: RotateCw,
            badge: 'System'
        },
        {
            id: 'cmd-theme',
            category: 'actions',
            title: '/theme',
            subtitle: 'Switch between light, dark, or system theme.',
            requiresArgs: true,
            autocompleteQuery: '/theme ',
            icon: SunMoon,
            badge: 'Theme'
        },
        {
            id: 'cmd-font',
            category: 'actions',
            title: '/font',
            subtitle: 'Change font style for article reading.',
            requiresArgs: true,
            autocompleteQuery: '/font ',
            icon: CaseSensitive,
            badge: 'Appearance'
        },
        {
            id: 'cmd-code',
            category: 'actions',
            title: '/code',
            subtitle: 'Configure code block formatting and theme.',
            requiresArgs: true,
            autocompleteQuery: '/code ',
            icon: CodeXml,
            badge: 'Code'
        },
        {
            id: 'cmd-a11y',
            category: 'actions',
            title: '/a11y',
            subtitle: 'Configure accessibility and display preferences.',
            requiresArgs: true,
            autocompleteQuery: '/a11y ',
            icon: PersonStanding,
            badge: 'Accessibility'
        },
        {
            id: 'cmd-copy',
            category: 'actions',
            title: '/copy',
            subtitle: 'Copy page link, identifier, or content.',
            requiresArgs: true,
            autocompleteQuery: '/copy ',
            icon: Copy,
            badge: 'Action'
        },
        {
            id: 'cmd-save',
            category: 'actions',
            title: '/save',
            subtitle: 'Download resume or export article file.',
            requiresArgs: true,
            autocompleteQuery: '/save ',
            icon: Save,
            badge: 'File'
        },
        {
            id: 'cmd-back',
            category: 'actions',
            title: '/back',
            subtitle: 'Navigate back to the previous page.',
            action: () => {
                ctx.close();
                if (typeof window !== 'undefined') {
                    if (window.history.length > 1) {
                        window.history.back();
                    } else {
                        toastStore.show('No previous page in history', 'info');
                    }
                }
            },
            icon: MoveLeft,
            badge: 'Navigation'
        },
        {
            id: 'cmd-forward',
            category: 'actions',
            title: '/forward',
            subtitle: 'Navigate forward to the next page.',
            action: () => {
                ctx.close();
                if (typeof window !== 'undefined') {
                    window.history.forward();
                }
            },
            icon: MoveRight,
            badge: 'Navigation'
        },
        {
            id: 'cmd-top',
            category: 'actions',
            title: '/top',
            subtitle: 'Scroll to the top of page.',
            action: () => {
                ctx.close();
                if (typeof window !== 'undefined') {
                    setTimeout(() => {
                        scrollToTop('smooth');
                        toastStore.show('Scrolled to top of page', 'info');
                    }, 50);
                }
            },
            icon: MoveUp,
            badge: 'Navigation'
        },
        {
            id: 'cmd-bottom',
            category: 'actions',
            title: '/bottom',
            subtitle: 'Scroll to the bottom of page.',
            action: () => {
                ctx.close();
                if (typeof window !== 'undefined') {
                    setTimeout(() => {
                        scrollToBottom('smooth');
                        toastStore.show('Scrolled to bottom of page', 'info');
                    }, 50);
                }
            },
            icon: MoveDown,
            badge: 'Navigation'
        },
        {
            id: 'cmd-print',
            category: 'actions',
            title: '/print',
            subtitle: 'Print current page or export PDF.',
            action: () => {
                ctx.close();
                if (typeof window !== 'undefined') {
                    setTimeout(() => window.print(), 150);
                }
            },
            icon: Printer,
            badge: 'System'
        },
        {
            id: 'cmd-cookies',
            category: 'actions',
            title: '/cookies',
            subtitle: 'Manage cookie preferences and consent settings.',
            action: () => {
                ctx.close();
                consentStore.openCustomizeModal();
            },
            icon: Cookie,
            badge: 'Privacy'
        },
        {
            id: 'cmd-rss',
            category: 'pages',
            title: '/rss',
            subtitle: 'Open RSS and Atom web feed.',
            url: '/atom.xml',
            icon: Rss,
            badge: 'Feed'
        },
        {
            id: 'cmd-llms',
            category: 'pages',
            title: '/llms',
            subtitle: 'Open LLM context guide for assistants.',
            url: '/llms.txt',
            icon: Bot,
            badge: 'AI'
        },
        {
            id: 'cmd-sitemap',
            category: 'pages',
            title: '/sitemap',
            subtitle: 'Open website sitemap XML document.',
            url: '/sitemap.xml',
            icon: Workflow,
            badge: 'System'
        },
        {
            id: 'cmd-api',
            category: 'pages',
            title: '/api',
            subtitle: 'Open developer REST API documentation.',
            url: apiUrl('', publicEnv.PUBLIC_API_BASE_URL),
            icon: Braces,
            badge: 'API'
        },
        {
            id: 'cmd-mailing',
            category: 'actions',
            title: '/mailing',
            subtitle: 'Subscribe or unsubscribe by email.',
            requiresArgs: true,
            autocompleteQuery: '/mailing ',
            validArgs: ['subscribe', 'unsubscribe'],
            icon: Mail,
            badge: 'Mailing'
        },
        {
            id: 'cmd-share',
            category: 'actions',
            title: '/share',
            subtitle: 'Open share dialog for current page.',
            action: () => {
                ctx.openShare();
            },
            icon: Share2,
            badge: 'Share'
        },
        {
            id: 'cmd-qr',
            category: 'actions',
            title: '/qr',
            subtitle: 'Display QR code for current page.',
            action: () => {
                ctx.openQr();
            },
            icon: QrCode,
            badge: 'Share'
        },
        {
            id: 'cmd-exit',
            category: 'actions',
            title: '/exit',
            subtitle: 'Close command palette or browser tab.',
            action: () => {
                if (typeof window !== 'undefined') {
                    window.close();
                    window.location.href = 'about:blank';
                }
            },
            icon: LogOut,
            badge: 'System'
        },
        {
            id: 'cmd-keyboard',
            category: 'actions',
            title: '/keyboard',
            subtitle: 'Open keyboard shortcuts catalog.',
            action: () => {
                ctx.setHelp(false);
                ctx.close();
                shortcutStore.catalogOpen = true;
            },
            icon: Keyboard,
            badge: 'Help'
        },
        {
            id: 'cmd-help',
            category: 'actions',
            title: '/help',
            subtitle: 'Show command and shortcut reference guide.',
            action: () => {
                ctx.setHelp(true);
            },
            icon: HelpCircle,
            badge: 'Help'
        },
        {
            id: 'cmd-read',
            category: 'actions',
            title: '/read',
            subtitle: 'Toggle distraction-free reading mode for articles.',
            action: () => {
                if (page.url.pathname.startsWith('/blog/')) {
                    readingModeStore.toggle();
                    ctx.close();
                } else {
                    toastStore.show('Reading mode is only available on blog posts');
                    ctx.close();
                }
            },
            icon: BookOpenText,
            badge: 'Reading'
        }
    ];
    return defaultCommands;
}
