import { apiUrl } from '#lib/apiConfig.ts';
import { parseMailingCommand, type MailingAction } from '#lib/mailing.ts';
import * as publicEnv from '$app/env/public';

import { page } from '$app/state';
import { codeBlockPrefsStore } from '@fkp/mdrs-ui/codeBlockPrefsStore.svelte.ts';
import { refreshCodeBlockPrefs, type CodeColorScheme } from '@fkp/mdrs-ui/codeBlocks.ts';
import { a11yStore, type FontScale } from '@fkp/ui/stores/a11yStore.svelte.ts';
import { contentFontStore, type ContentFont } from '@fkp/ui/stores/contentFontStore.svelte.ts';
import { themeStore } from '@fkp/ui/stores/themeStore.svelte.ts';
import { toastStore } from '@fkp/ui/stores/toastStore.svelte.ts';
import {
    Mail,
    FileText,
    SunMoon,
    Link,
    FileCode,
    SquareText,
    HeartHandshake,
    House,
    FolderOpen,
    FileUser,
    Rss,
    CodeXml,
    CaseSensitive,
    Save,
    Braces,
    Quote,
    MessageSquareWarning,
    ScrollText,
    ShieldUser,
    Lock,
    AtSign,
    PersonStanding
} from '@lucide/svelte';
import { tick } from 'svelte';
import type { SpotlightItem } from './types';
import type { SpotlightCommandContext } from './context';

export function applyContentFont(font: ContentFont, label: string) {
    if (contentFontStore.locked) {
        toastStore.show('Reading font is locked while the dyslexic-friendly font is on', 'info');
        return;
    }
    contentFontStore.setFont(font);
    toastStore.show(`Content font set to ${label}`, 'success');
}

export function createDynamicCommandItems(
    ctx: SpotlightCommandContext
): (query: string) => SpotlightItem[] {
    return function getDynamicCommandItems(query: string): SpotlightItem[] {
        const q = query.trim().toLowerCase();
        if (!q.startsWith('/')) return [];

        const items: SpotlightItem[] = [];
        const root = q.split(/\s+/)[0];

        if (root === '/mailing' || (root.length > 2 && '/mailing'.startsWith(root))) {
            const parsed = parseMailingCommand(query);
            const argument = q.split(/\s+/)[1] ?? '';
            const actions: MailingAction[] = ['subscribe', 'unsubscribe'];
            for (const action of actions) {
                if (parsed ? parsed.action !== action : !action.startsWith(argument)) continue;
                const email = parsed?.email ?? '';
                items.push({
                    id: `dyn-mailing-${action}`,
                    category: 'actions',
                    title: `/mailing ${action}${email ? ` ${email}` : ''}`,
                    subtitle:
                        action === 'subscribe' ?
                            'Confirm your subscription by email.'
                        :   'Receive a link to confirm unsubscribing.',
                    action: () => {
                        void tick().then(() => {
                            ctx.requestMailing({ action, email });
                        });
                    },
                    icon: Mail,
                    badge: 'Mailing'
                });
            }
            return items;
        }

        if (q.startsWith('/theme') || (root.length > 2 && '/theme'.startsWith(root))) {
            const parts = q.split(/\s+/);
            const arg = parts[1] || '';
            if (!arg || arg === 'auto' || 'auto'.startsWith(arg) || arg === 'system') {
                items.push({
                    id: 'dyn-theme-auto',
                    category: 'actions',
                    title: '/theme auto',
                    subtitle: 'Match theme to system settings.',
                    action: () => {
                        themeStore.apply('auto');
                        toastStore.show('Switched to system theme', 'success');
                    },
                    icon: SunMoon,
                    badge: 'Theme'
                });
            }
            if (!arg || arg === 'dark' || 'dark'.startsWith(arg)) {
                items.push({
                    id: 'dyn-theme-dark',
                    category: 'actions',
                    title: '/theme dark',
                    subtitle: 'Switch to dark color theme.',
                    action: () => {
                        themeStore.apply('dark');
                        toastStore.show('Switched to dark theme', 'success');
                    },
                    icon: SunMoon,
                    badge: 'Theme'
                });
            }
            if (!arg || arg === 'light' || 'light'.startsWith(arg)) {
                items.push({
                    id: 'dyn-theme-light',
                    category: 'actions',
                    title: '/theme light',
                    subtitle: 'Switch to light color theme.',
                    action: () => {
                        themeStore.apply('light');
                        toastStore.show('Switched to light theme', 'success');
                    },
                    icon: SunMoon,
                    badge: 'Theme'
                });
            }
        }

        if (q.startsWith('/font') || (root.length > 2 && '/font'.startsWith(root))) {
            const parts = q.split(/\s+/);
            const arg = parts[1] || '';
            if (!arg || arg === 'sans' || 'sans'.startsWith(arg)) {
                items.push({
                    id: 'dyn-font-sans',
                    category: 'actions',
                    title: '/font sans',
                    subtitle: 'Use clean sans serif font.',
                    action: () => applyContentFont('sans', 'Sans-serif'),
                    icon: CaseSensitive,
                    badge: 'Font'
                });
            }
            if (!arg || arg === 'serif' || 'serif'.startsWith(arg)) {
                items.push({
                    id: 'dyn-font-serif',
                    category: 'actions',
                    title: '/font serif',
                    subtitle: 'Use classic serif reading font.',
                    action: () => applyContentFont('serif', 'Serif'),
                    icon: CaseSensitive,
                    badge: 'Font'
                });
            }
            if (!arg || arg === 'mono' || 'mono'.startsWith(arg)) {
                items.push({
                    id: 'dyn-font-mono',
                    category: 'actions',
                    title: '/font mono',
                    subtitle: 'Use modern monospace coding font.',
                    action: () => applyContentFont('mono', 'Monospace'),
                    icon: CaseSensitive,
                    badge: 'Font'
                });
            }
        }

        if (q.startsWith('/a11y') || (root.length > 2 && '/a11y'.startsWith(root))) {
            const a11yFeatures = [
                {
                    key: 'reduce-motion',
                    name: 'Reduce motion animations',
                    subtitle: 'Toggle reduced animations and motion.',
                    toggle: () => a11yStore.toggleReduceMotion(),
                    state: () => a11yStore.current.reduceMotion
                },
                {
                    key: 'solid-surface',
                    name: 'Solid card surfaces',
                    subtitle: 'Toggle solid background surfaces mode.',
                    toggle: () => a11yStore.toggleSolidSurfaces(),
                    state: () => a11yStore.current.solidSurfaces
                },
                {
                    key: 'high-contrast',
                    name: 'High contrast mode',
                    subtitle: 'Toggle high contrast visual mode.',
                    toggle: () => a11yStore.toggleHighContrast(),
                    state: () => a11yStore.current.highContrast
                },
                {
                    key: 'focus-ring',
                    name: 'Enhanced focus indicator',
                    subtitle: 'Toggle visible keyboard focus outline.',
                    toggle: () => a11yStore.toggleFocusHighlight(),
                    state: () => a11yStore.current.focusHighlight
                },
                {
                    key: 'dyslexic-text',
                    name: 'Dyslexic-friendly font',
                    subtitle: 'Switch the whole site to Lexend.',
                    toggle: () => a11yStore.toggleDyslexicFont(),
                    state: () => a11yStore.current.dyslexicFont
                }
            ] as const;

            const parts = q.split(/\s+/);
            const subCmd = parts[1] || '';
            const val = parts[2] || '';

            for (const feat of a11yFeatures) {
                if (
                    !subCmd
                    || feat.key.includes(subCmd)
                    || feat.name.toLowerCase().includes(subCmd)
                ) {
                    const isCurrentlyOn = feat.state();
                    let targetAction = feat.toggle;

                    if (val === 'on') {
                        targetAction = () => {
                            if (!feat.state()) feat.toggle();
                            toastStore.show(`${feat.name}: ON`, 'success');
                        };
                    } else if (val === 'off') {
                        targetAction = () => {
                            if (feat.state()) feat.toggle();
                            toastStore.show(`${feat.name}: OFF`, 'success');
                        };
                    }

                    items.push({
                        id: `dyn-a11y-${feat.key}`,
                        category: 'actions',
                        title: `/a11y ${feat.key}${val ? `${val}` : ''}`,
                        subtitle: feat.subtitle,
                        action: () => {
                            targetAction();
                            if (!val) {
                                toastStore.show(
                                    `${feat.name}: ${!isCurrentlyOn ? 'ON' : 'OFF'}`,
                                    'success'
                                );
                            }
                        },
                        icon: PersonStanding,
                        badge: 'Accessibility'
                    });
                }
            }

            if (
                !subCmd
                || 'text-size'.includes(subCmd)
                || 'font-scale'.includes(subCmd)
                || 'size'.includes(subCmd)
            ) {
                const scales: FontScale[] = [100, 110, 120, 130, 140, 150];
                const parsedScale = parseInt(val.replace('%', ''), 10);

                if (scales.includes(parsedScale as FontScale)) {
                    items.push({
                        id: `dyn-a11y-scale-${parsedScale}`,
                        category: 'actions',
                        title: `/a11y text-size ${parsedScale}%`,
                        subtitle: 'Adjust text size scaling level.',
                        action: () => {
                            a11yStore.setFontScale(parsedScale as FontScale);
                            toastStore.show(`Text scale set to ${parsedScale}%`, 'success');
                        },
                        icon: PersonStanding,
                        badge: 'Accessibility'
                    });
                } else {
                    for (const s of [100, 110, 120, 130, 140, 150] as FontScale[]) {
                        if (!val || String(s).includes(val.replace('%', ''))) {
                            items.push({
                                id: `dyn-a11y-scale-${s}`,
                                category: 'actions',
                                title: `/a11y text-size ${s}%`,
                                subtitle: 'Adjust text size scaling level.',
                                action: () => {
                                    a11yStore.setFontScale(s);
                                    toastStore.show(`Text scale set to ${s}%`, 'success');
                                },
                                icon: PersonStanding,
                                badge: 'Accessibility'
                            });
                        }
                    }
                }
            }

            if (!subCmd || 'reset'.includes(subCmd)) {
                items.push({
                    id: 'dyn-a11y-reset',
                    category: 'actions',
                    title: '/a11y reset',
                    subtitle: 'Reset all accessibility preferences.',
                    action: () => {
                        a11yStore.reset();
                        toastStore.show('Accessibility settings reset to default', 'success');
                    },
                    icon: PersonStanding,
                    badge: 'Accessibility'
                });
            }
        }

        if (q.startsWith('/goto') || (root.length > 2 && '/goto'.startsWith(root))) {
            const parts = q.split(/\s+/);
            const sub = parts[1] || '';

            const openTargets = [
                {
                    name: 'home',
                    title: '/goto home',
                    subtitle: 'Navigate to the main home page.',
                    url: '/',
                    icon: House,
                    badge: 'Page'
                },
                {
                    name: 'blog',
                    title: '/goto blog',
                    subtitle: 'Read latest articles and posts.',
                    url: '/blog',
                    icon: Quote,
                    badge: 'Section'
                },
                {
                    name: 'projects',
                    title: '/goto projects',
                    subtitle: 'Explore featured projects and creations.',
                    url: '/#projects',
                    icon: FolderOpen,
                    badge: 'Section'
                },
                {
                    name: 'cv',
                    title: '/goto cv',
                    subtitle: 'View resume and work experience.',
                    url: '/#cv',
                    icon: FileUser,
                    badge: 'Section'
                },
                {
                    name: 'funding',
                    title: '/goto funding',
                    subtitle: 'Support projects and open development.',
                    url: '/#funding',
                    icon: HeartHandshake,
                    badge: 'Section'
                },
                {
                    name: 'contact',
                    title: '/goto contact',
                    subtitle: 'Send a message or connect.',
                    url: '/#contact',
                    icon: AtSign,
                    badge: 'Section'
                },
                {
                    name: 'terms',
                    title: '/goto terms',
                    subtitle: 'Read terms and conditions agreement.',
                    url: '/terms',
                    icon: ScrollText,
                    badge: 'Legal'
                },
                {
                    name: 'privacy',
                    title: '/goto privacy',
                    subtitle: 'Read privacy policy and practices.',
                    url: '/privacy',
                    icon: ShieldUser,
                    badge: 'Legal'
                },
                {
                    name: 'security',
                    title: '/goto security',
                    subtitle: 'View security policy and guidelines.',
                    url: '/security',
                    icon: Lock,
                    badge: 'Security'
                },
                {
                    name: 'feedback',
                    title: '/goto feedback',
                    subtitle: 'Send feedback and report issues.',
                    url: '/feedback',
                    icon: MessageSquareWarning,
                    badge: 'Help'
                },
                {
                    name: 'feed',
                    title: '/goto feed',
                    subtitle: 'Open RSS and Atom feed.',
                    url: '/atom.xml',
                    icon: Rss,
                    badge: 'Feed'
                },
                {
                    name: 'api',
                    title: '/goto api',
                    subtitle: 'Open developer API documentation.',
                    url: apiUrl('', publicEnv.PUBLIC_API_BASE_URL),
                    icon: Braces,
                    badge: 'Developer'
                }
            ];

            for (const target of openTargets) {
                if (!sub || target.name.startsWith(sub) || target.name.includes(sub)) {
                    items.push({
                        id: `dyn-open-${target.name}`,
                        category: 'actions',
                        title: target.title,
                        subtitle: target.subtitle,
                        url: target.url,
                        icon: target.icon,
                        badge: target.badge
                    });
                }
            }
        }

        if (q.startsWith('/copy') || (root.length > 2 && '/copy'.startsWith(root))) {
            const parts = q.split(/\s+/);
            const arg = parts[1] || '';
            const pathname = page?.url?.pathname || '';
            const isBlogPage = pathname.startsWith('/blog/') && pathname.length > 6;
            const isLegalPage = ['/terms', '/privacy', '/security'].includes(pathname);
            const currentSlug =
                isBlogPage ?
                    pathname.replace('/blog/', '').split('/')[0]
                :   pathname.replace('/', '');

            if (!arg || 'url'.startsWith(arg) || 'link'.startsWith(arg)) {
                items.push({
                    id: 'dyn-copy-url',
                    category: 'actions',
                    title: '/copy url',
                    subtitle: 'Copy web page address link.',
                    action: async () => {
                        if (typeof window !== 'undefined') {
                            await navigator.clipboard.writeText(window.location.href);
                            toastStore.show('Page URL copied to clipboard', 'success');
                        }
                    },
                    icon: Link,
                    badge: 'Copy'
                });
            }

            if (
                !arg
                || 'pid'.startsWith(arg)
                || 'page-id'.startsWith(arg)
                || 'id'.startsWith(arg)
            ) {
                items.push({
                    id: 'dyn-copy-pid',
                    category: 'actions',
                    title: '/copy pid',
                    subtitle: 'Copy current blog post identifier.',
                    action: async () => {
                        if (!isBlogPage || !currentSlug) {
                            toastStore.show(
                                "Command '/copy pid' is only available on blog post pages.",
                                'warning'
                            );
                            return;
                        }
                        if (typeof window !== 'undefined') {
                            const postId = (page.data as { post?: { id?: string } })?.post?.id;
                            const value = postId || currentSlug;
                            await navigator.clipboard.writeText(value);
                            toastStore.show(`Post ID copied: ${value}`, 'success');
                        }
                    },
                    icon: FileText,
                    badge: 'Copy'
                });
            }

            if (!arg || 'md'.startsWith(arg) || 'markdown'.startsWith(arg)) {
                items.push({
                    id: 'dyn-copy-md',
                    category: 'actions',
                    title: '/copy md',
                    subtitle: 'Copy article as markdown text.',
                    action: async () => {
                        if (!isBlogPage && !isLegalPage) {
                            toastStore.show(
                                "Command '/copy md' is only available on blog post or legal pages.",
                                'warning'
                            );
                            return;
                        }
                        try {
                            const res = await fetch(
                                isBlogPage ? `/blog/${currentSlug}.md` : `/${currentSlug}.md`
                            );
                            if (!res.ok) throw new Error();
                            const text = await res.text();
                            await navigator.clipboard.writeText(text);
                            toastStore.show('Markdown copied to clipboard', 'success');
                        } catch {
                            toastStore.show('Failed to copy markdown', 'error');
                        }
                    },
                    icon: FileCode,
                    badge: 'Copy'
                });
            }

            if (!arg || 'txt'.startsWith(arg) || 'text'.startsWith(arg)) {
                items.push({
                    id: 'dyn-copy-txt',
                    category: 'actions',
                    title: '/copy txt',
                    subtitle: 'Copy article as plain text.',
                    action: async () => {
                        if (!isBlogPage && !isLegalPage) {
                            toastStore.show(
                                "Command '/copy txt' is only available on blog post or legal pages.",
                                'warning'
                            );
                            return;
                        }
                        try {
                            const res = await fetch(
                                isBlogPage ? `/blog/${currentSlug}.txt` : `/${currentSlug}.txt`
                            );
                            if (!res.ok) throw new Error();
                            const text = await res.text();
                            await navigator.clipboard.writeText(text);
                            toastStore.show('Plaintext copied to clipboard', 'success');
                        } catch {
                            toastStore.show('Failed to copy plaintext', 'error');
                        }
                    },
                    icon: SquareText,
                    badge: 'Copy'
                });
            }
        }

        if (q.startsWith('/save') || (root.length > 2 && '/save'.startsWith(root))) {
            const parts = q.split(/\s+/);
            const arg = parts[1] || '';
            const pathname = page?.url?.pathname || '';
            const isBlogPage = pathname.startsWith('/blog/') && pathname.length > 6;
            const currentSlug = isBlogPage ? pathname.replace('/blog/', '').split('/')[0] : '';

            if (!arg || 'cv'.startsWith(arg) || 'curriculum-vitae'.startsWith(arg)) {
                items.push({
                    id: 'dyn-save-cv',
                    category: 'actions',
                    title: '/save cv',
                    subtitle: 'Download resume document as PDF.',
                    url: apiUrl('/cv?output=pdf', publicEnv.PUBLIC_API_BASE_URL),
                    icon: Save,
                    badge: 'File'
                });
            }

            if (!arg || 'md'.startsWith(arg) || 'markdown'.startsWith(arg)) {
                items.push({
                    id: 'dyn-save-md',
                    category: 'actions',
                    title: '/save md',
                    subtitle: 'Download article as markdown file.',
                    action: async () => {
                        if (!isBlogPage || !currentSlug) {
                            toastStore.show(
                                "Command '/save md' is only available on blog post pages.",
                                'warning'
                            );
                            return;
                        }
                        try {
                            const res = await fetch(`/blog/${currentSlug}.md`);
                            if (!res.ok) throw new Error();
                            const text = await res.text();
                            const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
                            const a = document.createElement('a');
                            a.href = URL.createObjectURL(blob);
                            a.download = `${currentSlug}.md`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(a.href);
                            toastStore.show(`Downloaded ${currentSlug}.md`, 'success');
                        } catch {
                            toastStore.show('Failed to download markdown', 'error');
                        }
                    },
                    icon: Save,
                    badge: 'File'
                });
            }

            if (!arg || 'txt'.startsWith(arg) || 'text'.startsWith(arg)) {
                items.push({
                    id: 'dyn-save-txt',
                    category: 'actions',
                    title: '/save txt',
                    subtitle: 'Download article as text file.',
                    action: async () => {
                        if (!isBlogPage || !currentSlug) {
                            toastStore.show(
                                "Command '/save txt' is only available on blog post pages.",
                                'warning'
                            );
                            return;
                        }
                        try {
                            const res = await fetch(`/blog/${currentSlug}.txt`);
                            if (!res.ok) throw new Error();
                            const text = await res.text();
                            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                            const a = document.createElement('a');
                            a.href = URL.createObjectURL(blob);
                            a.download = `${currentSlug}.txt`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(a.href);
                            toastStore.show(`Downloaded ${currentSlug}.txt`, 'success');
                        } catch {
                            toastStore.show('Failed to download plaintext', 'error');
                        }
                    },
                    icon: Save,
                    badge: 'File'
                });
            }
        }

        if (q.startsWith('/code') || (root.length > 2 && '/code'.startsWith(root))) {
            const parts = q.trim().split(/\s+/);
            const arg = (parts[1] || '').toLowerCase();
            const subArg = (parts[2] || '').toLowerCase();

            const booleanOptions = [
                {
                    key: 'wrap',
                    name: 'wrap',
                    label: 'Code wrap',
                    current: () => codeBlockPrefsStore.current.wrap,
                    toggle: () => codeBlockPrefsStore.toggleWrap(),
                    set: (val: boolean) => codeBlockPrefsStore.setWrap(val)
                },
                {
                    key: 'lines',
                    name: 'lines',
                    label: 'Code line numbers',
                    current: () => codeBlockPrefsStore.current.lineNumbers,
                    toggle: () => codeBlockPrefsStore.toggleLineNumbers(),
                    set: (val: boolean) => codeBlockPrefsStore.setLineNumbers(val)
                },
                {
                    key: 'clean',
                    name: 'clean',
                    label: 'Code clean mode',
                    current: () => codeBlockPrefsStore.current.minimal,
                    toggle: () => codeBlockPrefsStore.toggleMinimal(),
                    set: (val: boolean) => codeBlockPrefsStore.setMinimal(val)
                }
            ];

            for (const boolOpt of booleanOptions) {
                if (!arg || boolOpt.key.startsWith(arg)) {
                    if (!subArg) {
                        items.push({
                            id: `dyn-code-${boolOpt.key}`,
                            category: 'actions',
                            title: `/code ${boolOpt.key}`,
                            subtitle: `Toggle ${boolOpt.name} for code blocks.`,
                            action: () => {
                                boolOpt.toggle();
                                refreshCodeBlockPrefs();
                                toastStore.show(
                                    `${boolOpt.label} ${boolOpt.current() ? 'enabled' : 'disabled'}`,
                                    'info'
                                );
                            },
                            icon: CodeXml,
                            badge: 'Code'
                        });
                    }

                    if (arg === boolOpt.key) {
                        if (!subArg || 'on'.startsWith(subArg)) {
                            items.push({
                                id: `dyn-code-${boolOpt.key}-on`,
                                category: 'actions',
                                title: `/code ${boolOpt.key} on`,
                                subtitle: `Enable ${boolOpt.name} for code blocks.`,
                                action: () => {
                                    boolOpt.set(true);
                                    refreshCodeBlockPrefs();
                                    toastStore.show(`${boolOpt.label} enabled`, 'info');
                                },
                                icon: CodeXml,
                                badge: 'Code'
                            });
                        }
                        if (!subArg || 'off'.startsWith(subArg)) {
                            items.push({
                                id: `dyn-code-${boolOpt.key}-off`,
                                category: 'actions',
                                title: `/code ${boolOpt.key} off`,
                                subtitle: `Disable ${boolOpt.name} for code blocks.`,
                                action: () => {
                                    boolOpt.set(false);
                                    refreshCodeBlockPrefs();
                                    toastStore.show(`${boolOpt.label} disabled`, 'info');
                                },
                                icon: CodeXml,
                                badge: 'Code'
                            });
                        }
                    }
                }
            }

            if (!arg || 'theme'.startsWith(arg)) {
                if (!subArg) {
                    items.push({
                        id: 'dyn-code-theme',
                        category: 'actions',
                        title: '/code theme',
                        subtitle: 'Cycle color scheme for code.',
                        action: () => {
                            codeBlockPrefsStore.cycleColorScheme();
                            refreshCodeBlockPrefs();
                            toastStore.show(
                                `Code theme set to ${codeBlockPrefsStore.current.colorScheme}`,
                                'info'
                            );
                        },
                        icon: CodeXml,
                        badge: 'Code'
                    });
                }

                if (arg === 'theme') {
                    const themes: Array<{ key: CodeColorScheme; label: string }> = [
                        { key: 'auto', label: 'Match site theme' },
                        { key: 'dark', label: 'Dark theme' },
                        { key: 'light', label: 'Light theme' }
                    ];

                    for (const t of themes) {
                        if (!subArg || t.key.startsWith(subArg)) {
                            items.push({
                                id: `dyn-code-theme-${t.key}`,
                                category: 'actions',
                                title: `/code theme ${t.key}`,
                                subtitle: `Set code color scheme to ${t.label.toLowerCase()}.`,
                                action: () => {
                                    codeBlockPrefsStore.setColorScheme(t.key);
                                    refreshCodeBlockPrefs();
                                    toastStore.show(`Code theme set to ${t.key}`, 'info');
                                },
                                icon: CodeXml,
                                badge: 'Code'
                            });
                        }
                    }
                }
            }
        }

        return items;
    };
}
