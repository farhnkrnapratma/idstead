import { Marked, Renderer } from 'marked';
import { extractReferences, placeReferences } from './markdownReferences';
import markedFootnote from 'marked-footnote';
import katex from 'katex';
import {
    extractDefineBlock,
    evaluateDefineBlock,
    protectInterpolationTokens,
    resolveProtectedInterpolationTokens,
    createApiRegistry
} from '#lib/define.ts';
import { loadIcons } from '#lib/markdownIcons.ts';
import { sanitizeHtml, sanitizeUrl } from '#lib/sanitizeHtml.ts';

export { sanitizeUrl };

const ATTR_RE = /([a-zA-Z][\w-]*)="((?:[^"\\]|\\.)*)"/g;
const FENCE_MARK_RE = /(?:^|\s)mark=([\d.,]+)/;
const VIDEO_EXT_RE = /^[^?#]*\.(?:mp4|webm)(?:[?#].*)?$/i;

export function parseAttrs(source: string): Record<string, string> {
    const attrs: Record<string, string> = Object.create(null);
    for (const match of source.matchAll(ATTR_RE)) {
        attrs[match[1].toLowerCase()] = match[2].replace(/\\(["\\])/g, '$1');
    }
    return attrs;
}

export function escapeAttr(value: string): string {
    return value
        .replace(/&(?!#?\w+;)/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function escapeUrl(value: string): string {
    return escapeAttr(value.replace(/&/g, '&amp;'));
}

function parseFenceInfo(info: string): { lang: string; filename: string; mark: string } {
    const trimmed = info.trim();
    const lang = (trimmed.match(/^\S*/)?.[0] ?? '').toLowerCase();
    const rest = trimmed.slice(lang.length);
    const filename = parseAttrs(rest).filename?.trim() ?? '';
    const mark = rest.replace(ATTR_RE, '').match(FENCE_MARK_RE)?.[1] ?? '';
    return { lang, filename, mark };
}

function parseHighlightedLines(spec: string, totalLines: number): number[] {
    const lines = new Set<number>();
    for (const rawPart of spec.split(',')) {
        const part = rawPart.trim();
        const range = part.match(/^(\d+)\.\.(\d+)$/);
        if (range) {
            const start = Math.max(1, Number(range[1]));
            const end = Math.min(totalLines, Number(range[2]));
            for (let i = start; i <= end; i++) lines.add(i);
        } else if (/^\d+$/.test(part)) {
            const line = Number(part);
            if (line >= 1 && line <= totalLines) lines.add(line);
        }
    }
    return [...lines].sort((a, b) => a - b);
}

function cleanListItemHtml(html: string): string {
    let cleaned = html.trim();
    if (
        cleaned.startsWith('<p>')
        && cleaned.endsWith('</p>')
        && !cleaned.slice(3, -4).includes('<p>')
    ) {
        cleaned = cleaned.slice(3, -4).trim();
    }
    return cleaned;
}

export const markdownParser = new Marked();

markdownParser.use({
    renderer: {
        code(token) {
            const { lang, filename, mark } = parseFenceInfo(token.lang || '');

            if (lang === 'mermaid') {
                const encoded = encodeURIComponent(token.text);
                return `<div class="mermaid-block relative my-6 overflow-hidden rounded-md glass-card border border-border-subtle/60 text-text-primary shadow-md backdrop-blur-md transition-all duration-200">
  <div class="mermaid-display flex items-center justify-center p-6 overflow-x-auto">
    <div class="mermaid-loading flex items-center gap-2 text-xs text-text-muted">
      <span class="size-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent"></span>
      <span>Rendering diagram…</span>
    </div>
  </div>
  <div class="mermaid-raw-code hidden" data-content="${encoded}"></div>
</div>\n`;
            }

            if (lang === 'chart' || lang === 'layerchart') {
                const encoded = encodeURIComponent(token.text);
                return `<div class="markdown-chart-container my-6" data-chart-content="${encoded}">
  <div class="flex h-40 items-center justify-center rounded-md glass-card border border-border-subtle/60 text-xs text-text-muted">
    <span class="size-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent mr-2"></span>
    Loading chart visualization…
  </div>
</div>\n`;
            }

            const html = (Renderer.prototype.code as any).call(this, { ...token, lang });

            const totalLines = token.text.replace(/\n$/, '').split('\n').length;
            const highlightedLines = parseHighlightedLines(mark, totalLines);
            const preAttrs =
                (highlightedLines.length ?
                    ` data-highlight-lines="${highlightedLines.join(',')}"`
                :   '') + (filename ? ` data-filename="${escapeAttr(filename)}"` : '');
            if (!preAttrs) return html;

            return html.replace(/^<pre>/, () => `<pre${preAttrs}>`);
        },
        table(token) {
            const tableHtml = (Renderer.prototype.table as any).call(this, token);
            return `<div class="table-wrapper my-6 overflow-x-auto rounded-md border border-border-subtle shadow-2xs">\n${tableHtml}</div>\n`;
        },
        list(token) {
            const ordered = token.ordered;
            const start = token.start;
            let body = '';
            for (const item of token.items) {
                if (ordered) {
                    const text = cleanListItemHtml(this.parser.parse(item.tokens));
                    body += `<li class="ol-list-item my-1 pl-0.5 leading-normal">${text}</li>\n`;
                } else {
                    const itemText = item.text || '';
                    const itemRaw = item.raw || '';
                    const customTaskMatch =
                        itemText.match(/^\s*\[([ xX*/!\-?])]/i)
                        || itemRaw.match(/^\s*[-*+]\s+\[([ xX*/!\-?])]/i);

                    const isTask = item.task || customTaskMatch !== null;

                    if (isTask) {
                        let statusChar = ' ';
                        if (customTaskMatch) {
                            statusChar = customTaskMatch[1].toLowerCase();
                        } else if (item.checked) {
                            statusChar = 'x';
                        }

                        let checkboxSvg: string;
                        let textDecorationClass = '';

                        if (statusChar === 'x') {
                            checkboxSvg = `<span class="task-checkbox status-done flex h-5.5 w-4 shrink-0 items-center justify-center text-success translate-y-[0.5px]" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-check size-4 shrink-0 text-success"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg></span>`;
                        } else if (statusChar === '*') {
                            checkboxSvg = `<span class="task-checkbox status-wip flex h-5.5 w-4 shrink-0 items-center justify-center text-warning-strong translate-y-[0.5px]" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-asterisk size-4 shrink-0 text-warning-strong"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 8v8"/><path d="m8.5 14 7-4"/><path d="m8.5 10 7 4"/></svg></span>`;
                        } else if (statusChar === '/') {
                            checkboxSvg = `<span class="task-checkbox status-failed flex h-5.5 w-4 shrink-0 items-center justify-center text-danger translate-y-[0.5px]" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-x size-4 shrink-0 text-danger"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg></span>`;
                        } else if (statusChar === '-') {
                            checkboxSvg = `<span class="task-checkbox status-skipped flex h-5.5 w-4 shrink-0 items-center justify-center text-text-muted translate-y-[0.5px]" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-minus size-4 shrink-0 text-text-muted"><rect width="18" height="18" x="3" y="3" rx="2"/><line x1="8" x2="16" y1="12" y2="12"/></svg></span>`;
                            textDecorationClass = ' line-through opacity-75';
                        } else if (statusChar === '!') {
                            checkboxSvg = `<span class="task-checkbox status-important flex h-5.5 w-4 shrink-0 items-center justify-center text-copilot translate-y-[0.5px]" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-alert size-4 shrink-0 text-copilot"><rect width="18" height="18" x="3" y="3" rx="2"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg></span>`;
                        } else if (statusChar === '?') {
                            checkboxSvg = `<span class="task-checkbox status-question flex h-5.5 w-4 shrink-0 items-center justify-center text-a11y-focus translate-y-[0.5px]" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-square size-4 shrink-0 text-a11y-focus"><rect width="18" height="18" x="3" y="3" rx="2"/><rect width="8" height="8" x="8" y="8" rx="1"/></svg></span>`;
                        } else {
                            checkboxSvg = `<span class="task-checkbox status-pending flex h-5.5 w-4 shrink-0 items-center justify-center text-text-muted translate-y-[0.5px]" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square size-4 shrink-0 text-text-muted"><rect width="18" height="18" x="3" y="3" rx="2"/></svg></span>`;
                        }

                        const rawText = this.parser
                            .parse(item.tokens)
                            .replace(/<input\s+[^>]*type="checkbox"[^>]*>/gi, '')
                            .replace(/^(?:<p\b[^>]*>)?\s*\[[ xX*/!\-?]]\s*(?:<\/p>)?/i, match => {
                                return match.startsWith('<p') && !match.endsWith('</p>') ?
                                        '<p>'
                                    :   '';
                            })
                            .trim();
                        const text = cleanListItemHtml(rawText);
                        body += `<li class="task-list-item my-1 flex items-start gap-2 leading-normal">${checkboxSvg}<div class="task-content min-w-0 flex-1 leading-normal${textDecorationClass}">${text}</div></li>\n`;
                    } else {
                        const rawText = this.parser.parse(item.tokens).trim();
                        const text = cleanListItemHtml(rawText);
                        const dotSvg = `<span class="ul-dot flex h-5.5 w-2.5 shrink-0 items-center justify-center text-text-secondary translate-y-[0.5px]" aria-hidden="true"><span class="size-1.5 rounded-full bg-text-secondary"></span></span>`;
                        body += `<li class="ul-list-item my-1 flex items-start gap-1.5 leading-normal">${dotSvg}<div class="ul-content min-w-0 flex-1 leading-normal">${text}</div></li>\n`;
                    }
                }
            }
            const type = ordered ? 'ol' : 'ul';
            const startAttr = ordered && start !== 1 ? ` start="${start}"` : '';
            const listClass =
                ordered ?
                    'ol-list my-2 list-decimal space-y-1 pl-6'
                :   'ul-list my-2 flex list-none flex-col gap-1 pl-0';
            return `<${type}${startAttr} class="${listClass}">\n${body}</${type}>\n`;
        },
        link(token) {
            const href = sanitizeUrl(token.href || '') ?? '#';
            const title = token.title ? ` title="${escapeAttr(token.title)}"` : '';
            const text = this.parser.parseInline(token.tokens);
            const isOwnDomain = /^https?:\/\/(?:www\.)?fkp\.my\.id(?:\/|$)/i.test(href);
            const isExternal = /^https?:\/\//i.test(href) && !isOwnDomain;
            const safeHref = escapeUrl(href);
            if (!isExternal) {
                return `<a href="${safeHref}"${title}>${text}</a>`;
            }
            return `<a href="${safeHref}"${title} target="_blank" rel="noopener noreferrer" class="markdown-external-link inline">${text}${EXTERNAL_LINK_SVG}</a>`;
        },
        image(token) {
            const alt = escapeAttr(
                token.tokens ?
                    this.parser.parseInline(token.tokens, this.parser.textRenderer)
                :   token.text || ''
            );
            const href = sanitizeUrl(token.href || '');
            if (!href) return alt;
            const src = escapeUrl(href);
            const title = token.title ? ` title="${escapeAttr(token.title)}"` : '';
            if (VIDEO_EXT_RE.test(href)) {
                const label = alt ? ` aria-label="${alt}"` : '';
                return `<video controls preload="metadata" playsinline src="${src}"${title}${label}></video>`;
            }
            return `<img src="${src}" alt="${alt}"${title} loading="lazy" decoding="async">`;
        }
    }
});

markdownParser.use(markedFootnote({ refMarkers: true }));

export function protectWithPlaceholders(
    text: string,
    regex: RegExp,
    prefix: string,
    store: Map<string, string>
): string {
    let counter = store.size;
    return text.replace(regex, match => {
        const key = `@@${prefix}_${counter++}@@`;
        store.set(key, match);
        return key;
    });
}

export const FENCED_CODE_RE = /^[ \t]*(`{3,}|~{3,})[^\n]*\r?\n[\s\S]*?\r?\n[ \t]*\1[ \t]*$/gm;

export const INLINE_CODE_RE = /(`+)(?:[^\n`]|`(?!\1))+\1/g;

export const MATH_BLOCK_RE =
    /^((?: {0,3}>[ ]?)* {0,3}):::math[ \t]*\r?\n([\s\S]*?)\r?\n(?: {0,3}>[ ]?)* {0,3}:::[ \t]*$/gim;

export const MATH_INLINE_RE = /(?<!\\)\$\$(\s*[^\s$][^\n]*?)\$\$/g;

export const DIRECTIVE_OPEN_RE = /^[ \t]*:{2,}[a-zA-Z][a-zA-Z-]*(?:[ \t]+[^\n]*)?[ \t]*$/gm;

export const DIRECTIVE_CLOSE_RE = /^[ \t]*:{2,}[ \t]*$/gm;

export const PLACEHOLDER_RE = /@@[A-Z_]+_\d+@@/g;

const PLACEHOLDER_TOKEN_RE = /@@@[A-Z_]+_\d+@@@|@@[A-Z_]+_\d+@@/g;
const MAX_PLACEHOLDER_EXPANSIONS = 5000;

export function restoreAllPlaceholders(text: string, store: Map<string, string>): string {
    let budget = MAX_PLACEHOLDER_EXPANSIONS;
    const active = new Set<string>();
    const expand = (input: string): string =>
        input.replace(PLACEHOLDER_TOKEN_RE, token => {
            const value = store.get(token);
            if (value === undefined || active.has(token) || budget <= 0) return token;
            budget--;
            active.add(token);
            const expanded = expand(value);
            active.delete(token);
            return expanded;
        });
    return expand(text);
}

function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const IGNORE_RENDER_RE = /^[ \t]*:::ignore-render[^\n]*\r?\n([\s\S]*?)\r?\n[ \t]*:::[ \t]*$/gim;

export function extractIgnoreRenderBlocks(markdown: string, store: Map<string, string>): string {
    return markdown.replace(IGNORE_RENDER_RE, (_, content: string) => {
        const key = `@@IGNORE_RENDER_${store.size}@@`;
        store.set(key, `<pre>${escapeHtml(content.trim())}</pre>`);
        return `\n\n${key}\n\n`;
    });
}

function decodeMathEntities(str: string): string {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

interface MathSource {
    source: string;
    display: boolean;
}

export function extractMath(markdown: string, sources: Map<string, MathSource>): string {
    if (!markdown) return '';

    const codePlaceholders = new Map<string, string>();
    let text = protectWithPlaceholders(markdown, FENCED_CODE_RE, 'FENCED_CODE', codePlaceholders);
    text = protectWithPlaceholders(text, INLINE_CODE_RE, 'INLINE_CODE', codePlaceholders);

    let mathIndex = 0;
    const readSource = (source: string) =>
        decodeMathEntities(restoreAllPlaceholders(source, codePlaceholders).trim());

    text = text.replace(MATH_BLOCK_RE, (_, prefix: string, source: string) => {
        const key = `@@@MATH_BLOCK_${mathIndex++}@@@`;
        const quote = (prefix.match(/>/g) ?? []).length;
        const indent = prefix.length - prefix.replace(/ +$/, '').length;
        const body = source
            .split('\n')
            .map(line => {
                let rest = line.replace(/\r$/, '');
                for (let depth = 0; depth < quote; depth++) {
                    rest = rest.replace(QUOTE_MARKER_RE, '');
                }
                let strip = 0;
                while (strip < indent && rest[strip] === ' ') strip++;
                return rest.slice(strip);
            })
            .join('\n');
        sources.set(key, { source: readSource(body), display: true });
        const lead = '> '.repeat(quote).trimEnd();
        return quote ? `${lead}\n${prefix}${key}\n${lead}` : `\n${prefix}${key}\n`;
    });

    text = text.replace(MATH_INLINE_RE, (_, source: string) => {
        const key = `@@@MATH_INLINE_${mathIndex++}@@@`;
        sources.set(key, { source: readSource(source), display: false });
        return key;
    });

    return restoreAllPlaceholders(text, codePlaceholders);
}

function renderMathSource({ source, display }: MathSource): string {
    try {
        const html = katex.renderToString(source, { displayMode: display, throwOnError: false });
        return display ?
                `<div class="katex-block my-4 flex items-center justify-center overflow-x-auto py-2">${html}</div>`
            :   html;
    } catch {
        return display ?
                `<div class="katex-error text-danger font-mono text-xs">${escapeAttr(source)}</div>`
            :   `$$${escapeAttr(source)}$$`;
    }
}

export async function renderMathSources(
    sources: Map<string, MathSource>,
    resolveSource: (source: string) => Promise<string>
): Promise<Map<string, string>> {
    const rendered = new Map<string, string>();
    for (const [key, entry] of sources) {
        rendered.set(
            key,
            renderMathSource({ ...entry, source: await resolveSource(entry.source) })
        );
    }
    return rendered;
}

const EXTERNAL_LINK_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-external-link inline-block ml-0.5 size-2.5 align-baseline shrink-0"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>';

type NoteType = 'note' | 'tip' | 'important' | 'warning' | 'caution';

const NOTE_ICON_ATTRS =
    'xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const NOTE_CALLOUTS: Record<NoteType, { title: string; svg: string }> = {
    note: {
        title: 'Note',
        svg: `<svg ${NOTE_ICON_ATTRS} class="lucide lucide-info size-4 shrink-0 translate-y-[-6%]"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`
    },
    tip: {
        title: 'Tip',
        svg: `<svg ${NOTE_ICON_ATTRS} class="lucide lucide-lightbulb size-4 shrink-0 translate-y-[-6%]"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`
    },
    important: {
        title: 'Important',
        svg: `<svg ${NOTE_ICON_ATTRS} class="lucide lucide-message-square-warning size-4 shrink-0 translate-y-[-6%]"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v2"/><path d="M12 13h.01"/></svg>`
    },
    warning: {
        title: 'Warning',
        svg: `<svg ${NOTE_ICON_ATTRS} class="lucide lucide-alert-triangle size-4 shrink-0 translate-y-[-6%]"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`
    },
    caution: {
        title: 'Caution',
        svg: `<svg ${NOTE_ICON_ATTRS} class="lucide lucide-circle-alert size-4 shrink-0 translate-y-[-6%]"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`
    }
};

const CONTAINER_OPEN_RE = /^:::([a-zA-Z][a-zA-Z-]*)(?:[ \t]+([^\n]*))?$/;
const CONTAINER_CLOSE_RE = /^:::[ \t]*$/;
const TAB_OPEN_RE = /^::tab(?:[ \t]+([^\n]*))?$/i;
const TAB_CLOSE_RE = /^::[ \t]*$/;
const LINE_PREFIX_RE = /^((?: {0,3}>[ ]?)*)( {0,3})/;
const QUOTE_MARKER_RE = /^ {0,3}>[ ]?/;
const MAX_CONTAINER_DEPTH = 16;

const TAB_CONTAINERS = new Set(['tabs', 'snippets']);
const BLOCK_CONTAINERS = new Set([
    'callout',
    'details',
    'steps',
    'step',
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
    return `<span class="markdown-define-error">${escapeAttr(message)}</span>`;
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
    const isSnippets = frame.name === 'snippets';
    const buttons = frame.tabs
        .map((tab, index) => {
            const selected = index === 0;
            const label = escapeAttr(tab.attrs.label);
            const icon = (tab.attrs.icon && icons.get(tab.attrs.icon)) || '';
            return `<button type="button" role="tab" class="markdown-tab-button relative -mb-px inline-flex shrink-0 items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-[2.5px] transition-all cursor-pointer select-none ${
                selected ?
                    'active-tab text-accent border-b-accent font-bold'
                :   'text-text-muted border-b-transparent hover:text-text-primary'
            }" data-tab-label="${label}" aria-selected="${selected ? 'true' : 'false'}">${icon}${label}</button>`;
        })
        .join('');

    const panels = frame.tabs
        .map((tab, index) => {
            const selected = index === 0;
            return `<div role="tabpanel" class="markdown-tab-panel ${selected ? 'block' : 'hidden'}" ${selected ? '' : 'hidden'}>\n\n${trimBlock(tab.lines)}\n\n</div>`;
        })
        .join('');

    if (isSnippets) {
        const key = frame.attrs.key;
        const keyAttr = key ? ` data-tab-group-key="${escapeAttr(key)}"` : '';
        return `<div class="markdown-tabs-container group/codemin my-6 rounded-md border border-border-subtle shadow-2xs"${keyAttr}>
  <div class="markdown-tabs-header hljs relative flex min-h-8 items-end justify-between rounded-t-md border-b border-border-subtle px-3 pt-0 pb-0 select-none" role="tablist">
    <div class="markdown-tabs-nav flex min-w-0 flex-1 items-end gap-1.5 m-0 p-0 overflow-x-auto scrollbar-none [-ms-overflow-style:none]">
      ${buttons}
    </div>
    <div class="markdown-tabs-actions flex shrink-0 items-center gap-1 ml-2 self-center"></div>
  </div>
  <div class="markdown-tabs-body rounded-b-md">
    ${panels}
  </div>
</div>`;
    }

    return `<div class="markdown-tab-group my-6">
  <div class="markdown-tab-group-header relative flex min-h-8 items-end border-b border-border-subtle select-none" role="tablist">
    <div class="markdown-tab-group-nav flex min-w-0 flex-1 items-end gap-1.5 m-0 p-0 overflow-x-auto scrollbar-none [-ms-overflow-style:none]">
      ${buttons}
    </div>
  </div>
  <div class="markdown-tab-group-body pt-2">
    ${panels}
  </div>
</div>`;
}

function renderContainer(frame: ContainerFrame, icons: Map<string, string>): string {
    const content = trimBlock(frame.lines);

    if (frame.name in NOTE_CALLOUTS) {
        const type = frame.name as NoteType;
        const { title, svg } = NOTE_CALLOUTS[type];
        return `<div class="markdown-alert markdown-alert-${type}">
  <div class="markdown-alert-title leading-none">
    ${svg}
    <span>${title}</span>
  </div>
  <div class="markdown-alert-content">\n\n${content}\n\n</div>
</div>`;
    }

    if (frame.name === 'callout') {
        const title = frame.attrs.title?.trim();
        if (!title) return directiveError(':::callout requires title="..."');
        const icon = (frame.attrs.icon && icons.get(frame.attrs.icon)) || '';
        return `<div class="markdown-callout">
  <div class="markdown-callout-title leading-none">
    ${icon}<span>${escapeAttr(title)}</span>
  </div>
  <div class="markdown-callout-content">\n\n${content}\n\n</div>
</div>`;
    }

    if (frame.name === 'details') {
        const summary = frame.attrs.summary?.trim();
        if (!summary) return directiveError(':::details requires summary="..."');
        return `<details>\n<summary>${escapeAttr(summary)}</summary>\n\n${content}\n\n</details>`;
    }

    if (frame.name === 'steps' || frame.name === 'step') {
        return `<div class="markdown-steps-container my-6 ml-0 space-y-0">\n\n${content}\n\n</div>`;
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
        return `<a href="${escapeUrl(href)}" target="_blank" rel="noopener noreferrer">${escapeAttr(url)}</a>`;
    }

    return `<div class="markdown-embed-container my-6 aspect-video w-full overflow-hidden rounded-md glass-card border border-border-subtle/60 shadow-md backdrop-blur-md"><iframe src="${embedUrl}" loading="lazy" allowfullscreen class="h-full w-full" title="Embedded content"></iframe></div>`;
}

export function parseContainers(markdown: string, icons: Map<string, string> = new Map()): string {
    if (!markdown) return '';

    const placeholders = new Map<string, string>();
    let text = protectWithPlaceholders(markdown, FENCED_CODE_RE, 'FENCED_CODE', placeholders);
    text = protectWithPlaceholders(text, INLINE_CODE_RE, 'INLINE_CODE', placeholders);

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

    const output = root.lines.join('\n').replace(/^[ \t]*\d+\.[ \t]+(\[\^[\w-]+\]:.*)$/gm, '$1');

    return restoreAllPlaceholders(output, placeholders);
}

export function parseDetailsBlocks(html: string): string {
    if (!html) return '';

    const marker = '<details';
    let startIndex = html.indexOf(marker);
    if (startIndex === -1) return html;

    let result = '';
    let cursor = 0;

    while (startIndex !== -1) {
        result += html.slice(cursor, startIndex);
        const openTagEnd = html.indexOf('>', startIndex);
        if (openTagEnd === -1) {
            result += html.slice(startIndex);
            return result;
        }

        const openTag = html.slice(startIndex, openTagEnd + 1);
        const detailsAttrsMatch = openTag.match(/^<details([^>]*)>/i);
        const detailsAttrs = detailsAttrsMatch ? detailsAttrsMatch[1] : '';

        let depth = 1;
        let pos = openTagEnd + 1;

        while (depth > 0 && pos < html.length) {
            const nextOpen = html.indexOf('<details', pos);
            const nextClose = html.indexOf('</details>', pos);

            if (nextClose === -1) break;

            if (nextOpen !== -1 && nextOpen < nextClose) {
                depth++;
                pos = nextOpen + 8;
            } else {
                depth--;
                if (depth === 0) {
                    const inner = html.slice(openTagEnd + 1, nextClose).trim();
                    const summaryMatch = inner.match(/^\s*<summary([^>]*)>([\s\S]*?)<\/summary>/i);
                    let summaryAttrs = '';
                    let summaryTitle = 'Details';
                    let innerBody = inner;

                    if (summaryMatch) {
                        summaryAttrs = summaryMatch[1];
                        summaryTitle = summaryMatch[2].trim();
                        innerBody = inner.slice(summaryMatch[0].length).trim();
                    }

                    const processedBody = parseDetailsBlocks(innerBody);

                    result += `<details${detailsAttrs} class="group markdown-details my-4 overflow-hidden rounded-md glass-card border border-border-subtle text-text-primary shadow-md backdrop-blur-md">
 <summary${summaryAttrs} class="markdown-details-summary flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 border-b border-transparent group-open:border-border-subtle dark:group-open:border-white/10 px-3.5 py-1.5 font-medium text-sm text-text-primary hover:bg-surface-hover/50 transition-colors select-none [&::-webkit-details-marker]:hidden">
 <span class="inline-flex items-center gap-2">
 <span class="markdown-details-title translate-y-px font-medium text-sm text-text-primary leading-none">${summaryTitle}</span>
 </span>
 <span class="markdown-details-icon shrink-0 inline-flex items-center justify-center text-text-muted" aria-hidden="true">
 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevrons-up-down size-3.5 group-open:hidden"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevrons-down-up hidden size-3.5 group-open:block"><path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/></svg>
 </span>
 </summary>
 <div class="markdown-details-body px-3.5 py-3 font-sans font-normal text-sm leading-relaxed text-text-secondary">
 ${processedBody}
 </div>
</details>`;
                    cursor = nextClose + 10;
                    break;
                } else {
                    pos = nextClose + 10;
                }
            }
        }

        if (depth > 0) {
            result += html.slice(startIndex);
            return result;
        }

        startIndex = html.indexOf(marker, cursor);
    }

    result += html.slice(cursor);
    return result;
}

export function parseSteps(html: string): string {
    if (!html) return '';

    const marker = '<div class="markdown-steps-container';
    let startIndex = html.indexOf(marker);
    if (startIndex === -1) return html;

    let result = '';
    let cursor = 0;

    while (startIndex !== -1) {
        result += html.slice(cursor, startIndex);
        const openTagEnd = html.indexOf('>', startIndex);
        if (openTagEnd === -1) {
            result += html.slice(startIndex);
            return result;
        }

        const openTag = html.slice(startIndex, openTagEnd + 1);
        let depth = 1;
        let pos = openTagEnd + 1;

        while (depth > 0 && pos < html.length) {
            const nextOpen = html.indexOf('<div', pos);
            const nextClose = html.indexOf('</div>', pos);

            if (nextClose === -1) {
                break;
            }

            if (nextOpen !== -1 && nextOpen < nextClose) {
                depth++;
                pos = nextOpen + 4;
            } else {
                depth--;
                if (depth === 0) {
                    const innerContent = html.slice(openTagEnd + 1, nextClose).trim();
                    let processed = innerContent;

                    if (/<(ol|ul)\b/i.test(innerContent)) {
                        processed = innerContent.replace(
                            /<(ol|ul)([^>]*)>([\s\S]*?)<\/\1>/gi,
                            (_match: string, _tag: string, attrs: string, content: string) => {
                                const cleanAttrs = attrs.replace(/\s*class="[^"]*"/gi, '');
                                const transformedLi = content.replace(
                                    /<li([^>]*)>([\s\S]*?)<\/li>/gi,
                                    (_sub: string, liAttrs: string, liContent: string) => {
                                        const cleanLiAttrs = liAttrs.replace(
                                            /\s*class="[^"]*"/gi,
                                            ''
                                        );
                                        const cleanContent = liContent
                                            .replace(
                                                /<span class="ul-dot[\s\S]*?<\/span><\/span>/gi,
                                                ''
                                            )
                                            .trim();
                                        return `<li${cleanLiAttrs} class="markdown-step">${cleanContent}</li>`;
                                    }
                                );
                                return `<ol${cleanAttrs} class="markdown-steps-list">${transformedLi}</ol>`;
                            }
                        );
                    } else if (/<h[2-4]\b/i.test(innerContent)) {
                        const parts = innerContent.split(/(?=<h[2-4]\b)/i);
                        const intro =
                            parts[0] && !/^<h[2-4]\b/i.test(parts[0].trim()) ?
                                parts.shift() || ''
                            :   '';
                        processed =
                            intro
                            + parts
                                .filter(p => p.trim())
                                .map(part => `<div class="markdown-step">${part.trim()}</div>`)
                                .join('\n');
                    }

                    result += `${openTag}\n${processed}\n</div>`;
                    cursor = nextClose + 6;
                    break;
                } else {
                    pos = nextClose + 6;
                }
            }
        }

        if (depth > 0) {
            result += html.slice(startIndex);
            return result;
        }

        startIndex = html.indexOf(marker, cursor);
    }

    result += html.slice(cursor);
    return result;
}

function indexToLetter(idx: number): string {
    let result = '';
    let n = idx;
    while (n >= 0) {
        result = String.fromCharCode(97 + (n % 26)) + result;
        n = Math.floor(n / 26) - 1;
    }
    return result;
}

export function formatFootnoteReferences(html: string): string {
    const footnoteSectionRe =
        /<section\b([^>]*class="[^"]*footnotes[^"]*"[^>]*)>([\s\S]*?)<\/section>/gi;

    return html.replace(
        footnoteSectionRe,
        (_sectionMatch: string, sectionAttrs: string, sectionBody: string) => {
            const updatedSectionBody = sectionBody.replace(
                /<li\b([^>]*id="([^"]*)"[^>]*)>([\s\S]*?)<\/li>/gi,
                (_liMatch: string, liAttrs: string, _liId: string, liInner: string) => {
                    const backrefRe = /<a\b[^>]*data-[^>]*backref[^>]*>([\s\S]*?)<\/a>/gi;
                    const matches = [...liInner.matchAll(backrefRe)];
                    if (matches.length === 0) return _liMatch;

                    const hrefs: string[] = [];
                    for (const m of matches) {
                        const hrefAttr = m[0].match(/href="([^"]*)"/i);
                        if (hrefAttr) hrefs.push(hrefAttr[1]);
                    }

                    let cleaned = liInner.replace(
                        /\s*<a\b[^>]*data-[^>]*backref[^>]*>[\s\S]*?<\/a>/gi,
                        ''
                    );

                    let prefix: string;
                    if (hrefs.length === 1) {
                        prefix = `<a href="${hrefs[0]}" class="footnote-backref mr-1.5 inline-flex items-center font-mono text-security no-underline hover:underline select-none" aria-label="Back to reference">^</a>`;
                    } else {
                        const subLinks = hrefs
                            .map(
                                (href, i) =>
                                    `<a href="${href}" class="footnote-sub-backref text-security font-mono italic no-underline hover:underline select-none" aria-label="Back to reference ${indexToLetter(i)}">${indexToLetter(i)}</a>`
                            )
                            .join('');
                        prefix = `<span class="footnote-backref-static mr-1 inline-flex items-center font-mono text-text-muted select-none" aria-hidden="true">^</span><span class="footnote-sub-backrefs mr-1.5 inline-flex items-center gap-1 font-mono">${subLinks}</span>`;
                    }

                    if (/<p\b[^>]*>/i.test(cleaned)) {
                        cleaned = cleaned.replace(/^(<p\b[^>]*>)\s+/i, '$1');
                        cleaned = cleaned.replace(/(<p\b[^>]*>)/i, `$1${prefix}`);
                    } else {
                        cleaned = `${prefix}${cleaned.trimStart()}`;
                    }

                    return `<li${liAttrs}>${cleaned}</li>`;
                }
            );

            return `<section${sectionAttrs}>${updatedSectionBody}</section>`;
        }
    );
}

const MAX_MARKDOWN_LENGTH = 500_000;

export async function renderMarkdownUnsafe(
    markdown: string,
    supabaseClient?: any
): Promise<string> {
    if (markdown.length > MAX_MARKDOWN_LENGTH) {
        throw new Error('Markdown document is too large to render.');
    }
    const { raw: defineRaw, body: bodyAfterDefine } = extractDefineBlock(markdown);
    const apiRegistry = createApiRegistry(supabaseClient);
    const { scope } = await evaluateDefineBlock(defineRaw, apiRegistry);
    const ignoreRenderPlaceholders = new Map<string, string>();
    const withRawBlocksExtracted = extractIgnoreRenderBlocks(
        bodyAfterDefine,
        ignoreRenderPlaceholders
    );
    const interpolationPlaceholders = new Map<string, string>();
    const withInterpolationProtected = protectInterpolationTokens(
        withRawBlocksExtracted,
        interpolationPlaceholders
    );
    const mathSources = new Map<string, MathSource>();
    const withMathExtracted = extractMath(withInterpolationProtected, mathSources);
    const { output: withInterpolated } = await resolveProtectedInterpolationTokens(
        withMathExtracted,
        interpolationPlaceholders,
        scope,
        apiRegistry
    );
    const mathPlaceholders = await renderMathSources(mathSources, async source =>
        source.includes('@@INTERPOLATION_') ?
            (
                await resolveProtectedInterpolationTokens(
                    source,
                    interpolationPlaceholders,
                    scope,
                    apiRegistry
                )
            ).output
        :   source
    );
    const references = extractReferences(withInterpolated);
    const icons = await loadIcons(references.markdown);
    const withContainers = parseContainers(references.markdown, icons);
    const rawHtml = await markdownParser.parse(withContainers);
    const withDetails = parseDetailsBlocks(rawHtml);
    const withSteps = parseSteps(withDetails);
    const withFootnotes = placeReferences(formatFootnoteReferences(withSteps), references.marker);
    const withMathRestored = restoreAllPlaceholders(withFootnotes, mathPlaceholders);
    const withUnwrappedBlocks = withMathRestored
        .replace(/<p>\s*(<div class="katex-block[\s\S]*?<\/div>)\s*<\/p>/gi, '$1')
        .replace(/<p>\s*(@@IGNORE_RENDER_\d+@@)\s*<\/p>/gi, '$1');
    return restoreAllPlaceholders(withUnwrappedBlocks, ignoreRenderPlaceholders);
}

export async function renderMarkdown(markdown: string, supabaseClient?: any): Promise<string> {
    return sanitizeHtml(await renderMarkdownUnsafe(markdown, supabaseClient));
}

export const marked = markdownParser;

function replaceKatexWithSource(html: string): string {
    const opening = '<span class="katex">';
    const spanTag = /<(\/?)span\b[^>]*>/g;
    let output = '';
    let position = 0;
    for (;;) {
        const start = html.indexOf(opening, position);
        if (start === -1) return output + html.slice(position);
        output += html.slice(position, start);
        let depth = 0;
        let end = -1;
        spanTag.lastIndex = start;
        for (let tag = spanTag.exec(html); tag; tag = spanTag.exec(html)) {
            depth += tag[1] ? -1 : 1;
            if (depth === 0) {
                end = spanTag.lastIndex;
                break;
            }
        }
        if (end === -1) return output + html.slice(start);
        const source = html.slice(start, end).match(/<annotation[^>]*>([\s\S]*?)<\/annotation>/);
        output += source?.[1] ?? '';
        position = end;
    }
}

export function injectHeadingIds(html: string): string {
    let index = 0;
    const usedIds = new Set<string>();

    return html.replace(/<h([1-6])([^>]*)>(.*?)<\/h\1>/gi, (match, level, attrs, content) => {
        if (attrs.includes('id=')) {
            const idMatch = attrs.match(/id="([^"]*)"/);
            if (idMatch) {
                usedIds.add(idMatch[1]);
            }
            return match;
        }

        const text = replaceKatexWithSource(content).replace(/<[^>]*>/g, '');
        const baseId =
            text ?
                text
                    .toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/-+/g, '-')
                    .trim()
            :   `heading-${index++}`;

        let id = baseId;
        let counter = 1;
        while (usedIds.has(id)) {
            id = `${baseId}-${counter++}`;
        }
        usedIds.add(id);

        return `<h${level}${attrs} id="${id}">${content}</h${level}>`;
    });
}

export interface HeadingItem {
    id: string;
    text: string;
    level: number;
}

function decodeHtmlEntities(str: string): string {
    return str
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

export function extractHeadings(html: string): HeadingItem[] {
    const headings: HeadingItem[] = [];
    const headingRegex = /<h([2-6])\b[^>]*\bid="([^"]*)"[^>]*>([\s\S]*?)<\/h\1>/gi;
    let match;
    while ((match = headingRegex.exec(html)) !== null) {
        const opening = match[0].slice(0, match[0].indexOf('>') + 1);
        if (/class="[^"]*\bsr-only\b|\shidden(?:\s|>|=)|aria-hidden="true"/i.test(opening))
            continue;
        const level = parseInt(match[1], 10);
        const id = match[2];
        let content = replaceKatexWithSource(match[3])
            .replace(/<a\b[^>]*class="[^"]*anchor-link[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '')
            .trim();
        content = content.replace(
            /<(?!code\b|\/code|kbd\b|\/kbd|em\b|\/em|strong\b|\/strong|sub\b|\/sub|sup\b|\/sup)[^>]+>/gi,
            ''
        );
        const text = decodeHtmlEntities(content);
        headings.push({ id, text, level });
    }
    return headings;
}

export async function prepareMarkdownPage(
    markdown: string,
    supabaseClient?: any
): Promise<{ html: string; headings: HeadingItem[] }> {
    const rawHtml = await renderMarkdown(markdown, supabaseClient);
    const html = injectHeadingIds(rawHtml);
    const headings = extractHeadings(html);
    return { html, headings };
}
