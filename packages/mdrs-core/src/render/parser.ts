import { Marked, Renderer } from 'marked';
import markedFootnote from 'marked-footnote';
import { sanitizeUrl } from '../sanitize';
import { ATTR_RE, escapeAttr, escapeUrl, parseAttrs } from './attrs';
import { cleanListItemHtml, renderTaskItem, taskStatus } from './tasks';

const FENCE_MARK_RE = /(?:^|\s)mark=([\d.,]+)/;

const VIDEO_EXT_RE = /^[^?#]*\.(?:mp4|webm)(?:[?#].*)?$/i;

const POST_IMAGE_RE =
    /^https:\/\/[^/?#]+\/(?:blog\/[a-z0-9-]+|staging\/blog\/[0-9a-f-]{36})\/images\/[a-z0-9-]+\.avif$/;

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

export const markdownParser = new Marked();

markdownParser.use({
    renderer: {
        code(token) {
            const { lang, filename, mark } = parseFenceInfo(token.lang || '');

            if (lang === 'mermaid') {
                const encoded = encodeURIComponent(token.text);
                return `<div class="mdrs-mermaid"><div class="mdrs-mermaid-display"><div class="mdrs-mermaid-loading"><span class="mdrs-spinner"></span><span>Rendering diagram…</span></div></div><div class="mdrs-mermaid-source" hidden data-mdrs-source="${encoded}"></div></div>\n`;
            }

            if (lang === 'chart' || lang === 'layerchart') {
                const encoded = encodeURIComponent(token.text);
                return `<div class="mdrs-chart" data-mdrs-chart="${encoded}"><div class="mdrs-chart-loading"><span class="mdrs-spinner"></span>Loading chart visualization…</div></div>\n`;
            }

            const html = (Renderer.prototype.code as any).call(this, { ...token, lang });

            const totalLines = token.text.replace(/\n$/, '').split('\n').length;
            const highlightedLines = parseHighlightedLines(mark, totalLines);
            const preAttrs =
                (highlightedLines.length ?
                    ` data-mdrs-highlight-lines="${highlightedLines.join(',')}"`
                :   '') + (filename ? ` data-mdrs-filename="${escapeAttr(filename)}"` : '');
            if (!preAttrs) return html;

            return html.replace(/^<pre>/, () => `<pre${preAttrs}>`);
        },
        table(token) {
            const tableHtml = (Renderer.prototype.table as any).call(this, token);
            return `<div class="mdrs-table">\n${tableHtml}</div>\n`;
        },
        list(token) {
            const ordered = token.ordered;
            const loose = token.loose;
            let body = '';
            for (const item of token.items) {
                const html = this.parser.parse(item.tokens);
                const status = taskStatus(item);
                if (status !== null) {
                    body += renderTaskItem(html, status, loose);
                } else if (ordered) {
                    body += `<li class="mdrs-list-item">${cleanListItemHtml(html, loose)}</li>\n`;
                } else {
                    body += `<li class="mdrs-list-item"><span class="mdrs-list-marker" aria-hidden="true"></span><div class="mdrs-list-content">${cleanListItemHtml(html, loose)}</div></li>\n`;
                }
            }
            const type = ordered ? 'ol' : 'ul';
            const startAttr = ordered && token.start !== 1 ? ` start="${token.start}"` : '';
            const listClass = `mdrs-list mdrs-list--${ordered ? 'ordered' : 'unordered'}${loose ? ' mdrs-list--loose' : ''}`;
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
            return `<a href="${safeHref}"${title} target="_blank" rel="noopener noreferrer" class="mdrs-external-link">${text}${EXTERNAL_LINK_SVG}</a>`;
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
            if (POST_IMAGE_RE.test(href)) {
                const webp = escapeUrl(href.replace(/\.avif$/, '.webp'));
                return `<picture><source srcset="${src}" type="image/avif"><img src="${webp}" alt="${alt}"${title} loading="lazy" decoding="async"></picture>`;
            }
            return `<img src="${src}" alt="${alt}"${title} loading="lazy" decoding="async">`;
        }
    }
});

markdownParser.use(
    markedFootnote({
        refMarkers: true,
        prefixId: 'mdrs-fn-',
        prefixData: 'mdrs-',
        sectionClass: 'mdrs-footnotes',
        headingClass: 'mdrs-sr-only'
    })
);

export const EXTERNAL_LINK_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mdrs-icon mdrs-icon-external-link"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>';
