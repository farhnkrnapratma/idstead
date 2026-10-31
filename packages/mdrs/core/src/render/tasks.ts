// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import { type Tokens } from 'marked';

export function cleanListItemHtml(html: string, loose: boolean): string {
    let cleaned = html.trim();
    if (
        !loose
        && cleaned.startsWith('<p>')
        && cleaned.endsWith('</p>')
        && !cleaned.slice(3, -4).includes('<p>')
    ) {
        cleaned = cleaned.slice(3, -4).trim();
    }
    return cleaned;
}

const TASK_STATES: Record<string, { name: string; label: string; icon: string }> = {
    x: {
        name: 'done',
        label: 'Done',
        icon: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/>'
    },
    '*': {
        name: 'in-progress',
        label: 'In progress',
        icon: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 8v8"/><path d="m8.5 14 7-4"/><path d="m8.5 10 7 4"/>'
    },
    '/': {
        name: 'failed',
        label: 'Failed',
        icon: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>'
    },
    '-': {
        name: 'skipped',
        label: 'Skipped',
        icon: '<rect width="18" height="18" x="3" y="3" rx="2"/><line x1="8" x2="16" y1="12" y2="12"/>'
    },
    '!': {
        name: 'important',
        label: 'Important',
        icon: '<rect width="18" height="18" x="3" y="3" rx="2"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>'
    },
    '?': {
        name: 'question',
        label: 'Question',
        icon: '<rect width="18" height="18" x="3" y="3" rx="2"/><rect width="8" height="8" x="8" y="8" rx="1"/>'
    },
    ' ': { name: 'todo', label: 'To do', icon: '<rect width="18" height="18" x="3" y="3" rx="2"/>' }
};

const TASK_MARKER_RE = /^\s*\[([ xX*/!\-?])]/;

const TASK_RAW_MARKER_RE = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX*/!\-?])]/;

export function taskStatus(item: Tokens.ListItem): string | null {
    const match =
        (item.text || '').match(TASK_MARKER_RE) || (item.raw || '').match(TASK_RAW_MARKER_RE);
    if (match) return match[1].toLowerCase();
    if (item.task) return item.checked ? 'x' : ' ';
    return null;
}

export function renderTaskItem(html: string, status: string, loose: boolean): string {
    const state = TASK_STATES[status] ?? TASK_STATES[' '];
    const content = cleanListItemHtml(
        html
            .replace(/<input\s+[^>]*type="checkbox"[^>]*>/gi, '')
            .replace(/^(?:<p\b[^>]*>)?\s*\[[ xX*/!\-?]]\s*(?:<\/p>)?/i, match =>
                match.startsWith('<p') && !match.endsWith('</p>') ? '<p>' : ''
            )
            .trim(),
        loose
    );
    return `<li class="mdrs-list-item mdrs-task mdrs-task--${state.name}"><span class="mdrs-task-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mdrs-icon">${state.icon}</svg></span><span class="mdrs-sr-only">${state.label}: </span><div class="mdrs-task-content">${content}</div></li>\n`;
}
