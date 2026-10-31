// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { buttonKey, normalizeKey } from './shortcuts';

export const SHORTCUT_SECTIONS = [
    { id: 'movement', label: 'Movement', context: undefined },
    { id: 'goto', label: 'Go to', context: undefined },
    {
        id: 'page',
        label: 'This page',
        context:
            'These actions belong to controls on the current page. Available actions change when you navigate.'
    },
    {
        id: 'sharing',
        label: 'Copy, save & view',
        context:
            'Page links and resume downloads work across the site. Post IDs and article downloads require a blog post; copying Markdown or text also works on legal pages.'
    },
    { id: 'appearance', label: 'Appearance', context: undefined },
    {
        id: 'code',
        label: 'Code blocks',
        context:
            'Preferences apply to code blocks. Focus or hover a code block or tab group before using its local shortcuts.'
    },
    { id: 'blog', label: 'Blog post', context: 'These actions only work on a blog post page.' },
    {
        id: 'lists',
        label: 'Lists',
        context:
            'Press the key, then the number or letter shown on the item. Items are numbered in the order they appear on the page.'
    },
    {
        id: 'forms',
        label: 'Forms & filters',
        context:
            'Press ctrl+enter (cmd+enter on Mac) inside any form to send it; enter adds a new line in message boxes. The shortcuts below work in the focused form or filter bar on this page.'
    },
    {
        id: 'dialogs',
        label: 'Dialogs',
        context: 'These shortcuts work while the corresponding dialog is open.'
    },
    { id: 'system', label: 'Search & system', context: undefined }
] as const;

export type ShortcutSection = (typeof SHORTCUT_SECTIONS)[number]['id'];

const commandSections: Record<string, ShortcutSection> = {
    '/back': 'movement',
    '/forward': 'movement',
    '/top': 'movement',
    '/bottom': 'movement',
    '/goto': 'goto',
    '/home': 'goto',
    '/projects': 'goto',
    '/blog': 'goto',
    '/resume': 'goto',
    '/funding': 'goto',
    '/contact': 'goto',
    '/privacy': 'goto',
    '/terms': 'goto',
    '/ai-disclosure': 'goto',
    '/security': 'goto',
    '/rss': 'goto',
    '/llms': 'goto',
    '/sitemap': 'goto',
    '/api': 'goto',
    '/read': 'page',
    '/print': 'page',
    '/qr': 'page',
    '/refresh': 'page',
    '/share': 'page',
    '/feedback': 'page',
    '/copy': 'sharing',
    '/save': 'sharing',
    '/theme': 'appearance',
    '/a11y': 'appearance',
    '/code': 'code',
    '/mailing': 'forms',
    '/open': 'system',
    '/help': 'system',
    '/keyboard': 'system',
    '/cookies': 'system',
    '/exit': 'system'
};

export function commandSection(command: string): ShortcutSection {
    return commandSections[command] ?? 'system';
}

const BUTTON_SECTIONS: [string[], ShortcutSection][] = [
    [['skipLink', 'pagePrev', 'pageNext'], 'movement'],
    [['dialogClose'], 'dialogs'],
    [['formClear', 'formSubmit', 'filterSearch', 'sortDirection', 'clearFilters'], 'forms'],
    [['helpfulYes', 'helpfulNo', 'shareFeedback'], 'blog']
];

export function actionSection(entry: {
    scope: string;
    group?: string;
    combos: string[];
}): ShortcutSection {
    if (entry.scope.startsWith('dialog-')) return 'dialogs';
    if (entry.group === 'code' || /^(code|tabs)-/.test(entry.scope)) return 'code';
    if (['copy', 'save', 'view'].includes(entry.group ?? '')) return 'sharing';
    if (entry.group === 'go') return 'goto';
    const combo = normalizeKey(entry.combos[0] ?? '');
    for (const [ids, section] of BUTTON_SECTIONS) {
        if (ids.some(id => normalizeKey(buttonKey(id)) === combo)) return section;
    }
    return 'page';
}

const LEADING_KEYS = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', '[', ']', 'enter'];

function comboRank(key: string): number {
    if (LEADING_KEYS.includes(key)) return 0;
    if (key.startsWith('alt+')) return 3;
    if (key.startsWith('shift+')) return 2;
    return 1;
}

export function compareCombos(a: string, b: string): number {
    const keyA = normalizeKey(a);
    const keyB = normalizeKey(b);
    return (
        comboRank(keyA) - comboRank(keyB)
        || LEADING_KEYS.indexOf(keyA) - LEADING_KEYS.indexOf(keyB)
        || keyA.localeCompare(keyB)
    );
}
