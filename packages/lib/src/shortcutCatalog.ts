import { buttonKey, normalizeKey } from './shortcuts';

export const SHORTCUT_SECTIONS = [
    { id: 'navigation', label: 'Pages & navigation', context: undefined },
    { id: 'appearance', label: 'Appearance & accessibility', context: undefined },
    {
        id: 'blog',
        label: 'Blog reading',
        context:
            'These actions only work on a blog post page. Some controls appear only when the article supports them.'
    },
    {
        id: 'code',
        label: 'Code blocks & tabs',
        context:
            'Preferences apply to code blocks. Focus or hover a code block or tab group before using its local shortcuts.'
    },
    {
        id: 'sharing',
        label: 'Sharing & downloads',
        context:
            'Page links, sharing, and CV downloads work across the site. Post IDs and article downloads require a blog post; copying Markdown or text also works on legal pages.'
    },
    {
        id: 'forms',
        label: 'Forms',
        context:
            'Press Ctrl+Enter (Cmd+Enter on Mac) inside any form to send it; Enter adds a new line in message boxes. The shortcuts below work in the focused form on this page, such as a comment or feedback form.'
    },
    {
        id: 'page',
        label: 'Current page',
        context:
            'These actions belong to controls on the current page. Available actions change when you navigate.'
    },
    {
        id: 'dialogs',
        label: 'Dialogs',
        context: 'These shortcuts work while the corresponding dialog is open.'
    },
    { id: 'resources', label: 'Site resources & policies', context: undefined },
    { id: 'system', label: 'Search & system', context: undefined }
] as const;

export type ShortcutSection = (typeof SHORTCUT_SECTIONS)[number]['id'];

const commandSections: Record<string, ShortcutSection> = {
    '/goto': 'navigation',
    '/home': 'navigation',
    '/projects': 'navigation',
    '/blog': 'navigation',
    '/cv': 'navigation',
    '/funding': 'navigation',
    '/contact': 'navigation',
    '/back': 'navigation',
    '/forward': 'navigation',
    '/top': 'navigation',
    '/bottom': 'navigation',
    '/theme': 'appearance',
    '/font': 'appearance',
    '/a11y': 'appearance',
    '/read': 'blog',
    '/code': 'code',
    '/copy': 'sharing',
    '/save': 'sharing',
    '/share': 'sharing',
    '/qr': 'sharing',
    '/print': 'sharing',
    '/privacy': 'resources',
    '/terms': 'resources',
    '/security': 'resources',
    '/cookies': 'resources',
    '/rss': 'resources',
    '/llms': 'resources',
    '/sitemap': 'resources',
    '/api': 'resources',
    '/feedback': 'resources',
    '/mailing': 'forms',
    '/open': 'system',
    '/refresh': 'system',
    '/exit': 'system',
    '/keyboard': 'system',
    '/help': 'system'
};

export function commandSection(command: string): ShortcutSection {
    return commandSections[command] ?? 'system';
}

export function actionSection(
    entry: { scope: string; group?: string; combos: string[] },
    pathname: string
): ShortcutSection {
    if (entry.scope.startsWith('dialog-')) return 'dialogs';
    if (entry.group === 'code' || /^(code|tabs)-/.test(entry.scope)) return 'code';
    if (['copy', 'save', 'view'].includes(entry.group ?? '')) return 'sharing';
    const combo = normalizeKey(entry.combos[0] ?? '');
    if (combo === normalizeKey(buttonKey('dialogClose'))) return 'dialogs';
    if (combo === normalizeKey(buttonKey('skipLink'))) return 'navigation';
    if (['formClear', 'formSubmit'].some(id => normalizeKey(buttonKey(id)) === combo))
        return 'forms';
    if (
        pathname.startsWith('/blog/')
        && [
            'readingOptions',
            'moreActions',
            'tldr',
            'summary',
            'helpfulYes',
            'helpfulNo',
            'shareFeedback'
        ].some(id => normalizeKey(buttonKey(id)) === combo)
    )
        return 'blog';
    return 'page';
}
