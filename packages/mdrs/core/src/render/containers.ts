// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import { sanitizeUrl } from '../sanitize';
import {
    PLACEHOLDER_TOKEN_RE,
    protectFencedCode,
    protectInlineCode,
    restoreAllPlaceholders
} from '../placeholders';
import { escapeAttr, escapeUrl, parseAttrs } from './attrs';
import { EXTERNAL_LINK_SVG } from './parser';

type NoteType = 'note' | 'tip' | 'important' | 'warning' | 'caution';

const NOTE_ICON_ATTRS =
    'xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const NOTE_CALLOUTS: Record<NoteType, { title: string; svg: string }> = {
    note: {
        title: 'Note',
        svg: `<svg ${NOTE_ICON_ATTRS} class="mdrs-icon mdrs-icon-info"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`
    },
    tip: {
        title: 'Tip',
        svg: `<svg ${NOTE_ICON_ATTRS} class="mdrs-icon mdrs-icon-lightbulb"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`
    },
    important: {
        title: 'Important',
        svg: `<svg ${NOTE_ICON_ATTRS} class="mdrs-icon mdrs-icon-message-square-warning"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v2"/><path d="M12 13h.01"/></svg>`
    },
    warning: {
        title: 'Warning',
        svg: `<svg ${NOTE_ICON_ATTRS} class="mdrs-icon mdrs-icon-alert-triangle"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`
    },
    caution: {
        title: 'Caution',
        svg: `<svg ${NOTE_ICON_ATTRS} class="mdrs-icon mdrs-icon-circle-alert"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`
    }
};

const CONTAINER_OPEN_RE = /^:::([a-zA-Z][a-zA-Z-]*)(?:[ \t]+([^\n]*))?$/;

const CONTAINER_CLOSE_RE = /^:::[ \t]*$/;

const TAB_OPEN_RE = /^::tab(?:[ \t]+([^\n]*))?$/i;

const TAB_CLOSE_RE = /^::[ \t]*$/;

const LINE_PREFIX_RE = /^((?: {0,3}>[ ]?)*)( {0,3})/;

export const QUOTE_MARKER_RE = /^ {0,3}>[ ]?/;

const MAX_CONTAINER_DEPTH = 16;

const TAB_CONTAINERS = new Set(['tabs', 'snippets']);

const BLOCK_CONTAINERS = new Set([
    'callout',
    'details',
    'steps',
    ...TAB_CONTAINERS,
    ...Object.keys(NOTE_CALLOUTS)
]);

interface TabEntry {
    attrs: Record<string, string>;
    openLine: string;
    lines: string[];
}

interface ContainerFrame {
    name: string;
    attrs: Record<string, string>;
    openLine: string;
    quote: number;
    indent: number;
    lines: string[];
    tabs: TabEntry[];
    tab: TabEntry | null;
}

function splitLinePrefix(line: string): { quote: number; indent: number; rest: string } {
    const match = LINE_PREFIX_RE.exec(line)!;
    return {
        quote: (match[1].match(/>/g) ?? []).length,
        indent: match[2].length,
        rest: line.slice(match[0].length)
    };
}

function stripFramePrefix(line: string, frame: ContainerFrame): string | null {
    let rest = line;
    for (let depth = 0; depth < frame.quote; depth++) {
        const marker = QUOTE_MARKER_RE.exec(rest);
        if (!marker) return rest.trim() === '' ? '' : null;
        rest = rest.slice(marker[0].length);
    }
    let strip = 0;
    while (strip < frame.indent && rest[strip] === ' ') strip++;
    return rest.slice(strip);
}

function applyFramePrefix(lines: string[], frame: ContainerFrame): string[] {
    const quote = '> '.repeat(frame.quote);
    const padding = ' '.repeat(frame.indent);
    return lines.map(line => (line === '' ? quote.trimEnd() : `${quote}${padding}${line}`));
}

function directiveError(message: string): string {
    return `<span class="mdrs-define-error">${escapeAttr(message)}</span>`;
}

function frameTarget(frame: ContainerFrame): string[] {
    return frame.tab ? frame.tab.lines : frame.lines;
}

function trimBlock(lines: string[]): string {
    return lines.join('\n').replace(/^(?:[ \t]*\n)+|\s+$/g, '');
}

function renderTabs(frame: ContainerFrame, icons: Map<string, string>): string {
    if (frame.tabs.length === 0) {
        return directiveError(`:::${frame.name} requires at least one ::tab`);
    }
    if (frame.tabs.some(tab => !tab.attrs.label?.trim())) {
        return directiveError(`Every ::tab in :::${frame.name} requires label="..."`);
    }
    const block = frame.name === 'snippets' ? 'mdrs-snippets' : 'mdrs-tabs';
    const buttons = frame.tabs
        .map((tab, index) => {
            const selected = index === 0;
            const label = escapeAttr(tab.attrs.label);
            const icon = (tab.attrs.icon && icons.get(tab.attrs.icon)) || '';
            return `<button type="button" role="tab" class="mdrs-tab${selected ? ' mdrs-is-active' : ''}" data-mdrs-tab-label="${label}" aria-selected="${selected ? 'true' : 'false'}">${icon}${label}</button>`;
        })
        .join('');

    const panels = frame.tabs
        .map((tab, index) => {
            const selected = index === 0;
            return `<div role="tabpanel" class="mdrs-tab-panel"${selected ? '' : ' hidden'}>\n\n${trimBlock(tab.lines)}\n\n</div>`;
        })
        .join('');

    const key = frame.name === 'snippets' ? frame.attrs.key : '';
    const keyAttr = key ? ` data-mdrs-tab-key="${escapeAttr(key)}"` : '';
    const actions = frame.name === 'snippets' ? `\n    <div class="${block}-actions"></div>` : '';
    return `<div class="${block}"${keyAttr}>
  <div class="${block}-header${frame.name === 'snippets' ? ' hljs' : ''}" role="tablist">
    <div class="${block}-nav">
      ${buttons}
    </div>${actions}
  </div>
  <div class="${block}-body">
    ${panels}
  </div>
</div>`;
}

function renderContainer(frame: ContainerFrame, icons: Map<string, string>): string {
    const content = trimBlock(frame.lines);

    if (frame.name in NOTE_CALLOUTS) {
        const type = frame.name as NoteType;
        const { title, svg } = NOTE_CALLOUTS[type];
        return `<div class="mdrs-alert mdrs-alert--${type}">
  <div class="mdrs-alert-title">
    ${svg}
    <span>${title}</span>
  </div>
  <div class="mdrs-alert-content">\n\n${content}\n\n</div>
</div>`;
    }

    if (frame.name === 'callout') {
        const title = frame.attrs.title?.trim();
        if (!title) return directiveError(':::callout requires title="..."');
        const icon = (frame.attrs.icon && icons.get(frame.attrs.icon)) || '';
        return `<div class="mdrs-callout">
  <div class="mdrs-callout-title">
    ${icon}<span>${escapeAttr(title)}</span>
  </div>
  <div class="mdrs-callout-content">\n\n${content}\n\n</div>
</div>`;
    }

    if (frame.name === 'details') {
        const summary = frame.attrs.summary?.trim();
        if (!summary) return directiveError(':::details requires summary="..."');
        return `<details>\n<summary>${escapeAttr(summary)}</summary>\n\n${content}\n\n</details>`;
    }

    if (frame.name === 'steps') {
        return `<div class="mdrs-steps">\n\n${content}\n\n</div>`;
    }

    return renderTabs(frame, icons);
}

const YOUTUBE_EMBED_RE =
    /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^\s#]*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]+)/i;

const CODEPEN_EMBED_RE = /^https?:\/\/codepen\.io\/([\w-]+)\/pen\/([\w-]+)/i;

function renderEmbed(attrs: Record<string, string>): string {
    const url = attrs.url?.trim();
    if (!url) return directiveError(':::embed requires url="..."');

    const youtube = url.match(YOUTUBE_EMBED_RE);
    const codepen = url.match(CODEPEN_EMBED_RE);
    const embedUrl =
        youtube ? `https://www.youtube.com/embed/${youtube[1]}`
        : codepen ? `https://codepen.io/${codepen[1]}/embed/${codepen[2]}?default-tab=result`
        : null;

    if (!embedUrl) {
        const href = sanitizeUrl(url);
        if (!href || !/^https?:\/\//i.test(href)) return escapeAttr(url);
        return `<a href="${escapeUrl(href)}" target="_blank" rel="noopener noreferrer" class="mdrs-external-link">${escapeAttr(url)}${EXTERNAL_LINK_SVG}</a>`;
    }

    return `<div class="mdrs-embed"><iframe src="${embedUrl}" loading="lazy" allowfullscreen title="Embedded content"></iframe></div>`;
}

export function parseContainers(markdown: string, icons: Map<string, string> = new Map()): string {
    if (!markdown) return '';

    const placeholders = new Map<string, string>();
    let text = protectFencedCode(markdown, 'FENCED_CODE', placeholders);
    text = protectInlineCode(text, 'INLINE_CODE', placeholders);

    const attrSource = (value: string) =>
        restoreAllPlaceholders(value, placeholders).replace(PLACEHOLDER_TOKEN_RE, '');

    const root: ContainerFrame = {
        name: '',
        attrs: {},
        openLine: '',
        quote: 0,
        indent: 0,
        lines: [],
        tabs: [],
        tab: null
    };
    const stack: ContainerFrame[] = [root];
    const top = () => stack[stack.length - 1];

    const closeFrame = () => {
        const frame = stack.pop()!;
        frameTarget(top()).push(
            ...applyFramePrefix(['', ...renderContainer(frame, icons).split('\n'), ''], frame)
        );
    };

    const closeLiteral = () => {
        const frame = stack.pop()!;
        frameTarget(top()).push(
            ...applyFramePrefix(
                [
                    frame.openLine,
                    ...frame.lines,
                    ...frame.tabs.flatMap(tab => [tab.openLine, ...tab.lines])
                ],
                frame
            )
        );
    };

    const resolveLine = (raw: string): string => {
        for (;;) {
            let line = raw;
            let broken = -1;
            for (let depth = 1; depth < stack.length; depth++) {
                const next = stripFramePrefix(line, stack[depth]);
                if (next === null) {
                    broken = depth;
                    break;
                }
                line = next;
            }
            if (broken === -1) return line;
            while (stack.length > broken) closeLiteral();
        }
    };

    for (const raw of text.split('\n')) {
        const line = resolveLine(raw);
        const bare = line.replace(/\r$/, '');
        const { quote, indent, rest } = splitLinePrefix(bare);
        const current = top();

        if (
            quote === 0
            && TAB_CONTAINERS.has(current.name)
            && (TAB_OPEN_RE.test(rest) || (current.tab && TAB_CLOSE_RE.test(rest)))
        ) {
            current.tab = null;
            const tabMatch = rest.match(TAB_OPEN_RE);
            if (tabMatch) {
                const tab = {
                    attrs: parseAttrs(attrSource(tabMatch[1] || '')),
                    openLine: line,
                    lines: []
                };
                current.tabs.push(tab);
                current.tab = tab;
            }
            continue;
        }

        if (quote === 0 && CONTAINER_CLOSE_RE.test(rest)) {
            if (stack.length === 1) {
                root.lines.push(line);
            } else if (BLOCK_CONTAINERS.has(current.name)) {
                closeFrame();
            } else {
                closeLiteral();
                frameTarget(top()).push(line);
            }
            continue;
        }

        const open = stack.length <= MAX_CONTAINER_DEPTH ? rest.match(CONTAINER_OPEN_RE) : null;
        if (open) {
            const name = open[1].toLowerCase();
            const attrs = parseAttrs(attrSource(open[2] || ''));
            const frame: ContainerFrame = {
                name,
                attrs,
                openLine: line,
                quote,
                indent,
                lines: [],
                tabs: [],
                tab: null
            };
            if (name === 'embed') {
                frameTarget(current).push(...applyFramePrefix(['', renderEmbed(attrs), ''], frame));
            } else {
                stack.push(frame);
            }
            continue;
        }

        frameTarget(current).push(line);
    }

    while (stack.length > 1) closeLiteral();

    return restoreAllPlaceholders(root.lines.join('\n'), placeholders);
}
