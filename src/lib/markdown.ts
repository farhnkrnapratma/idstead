import {Marked, Renderer} from 'marked';
import markedFootnote from 'marked-footnote';
import katex from 'katex';
import {
  extractDefineBlock,
  evaluateDefineBlock,
  protectInterpolationTokens,
  resolveProtectedInterpolationTokens,
  createApiRegistry
} from '$lib/define';

const HIGHLIGHT_META_RE = /\{([\d,\s-]+)\}/;

function parseHighlightedLines(
  infostring: string,
  totalLines: number
): number[] {
  const match = infostring.match(HIGHLIGHT_META_RE);
  if (!match) return [];

  const lines = new Set<number>();
  for (const rawPart of match[1].split(',')) {
    const part = rawPart.trim();
    if (!part) continue;

    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map(s => s.trim());
      const start = Number(startStr);
      const end = Number(endStr);
      if (Number.isInteger(start) && Number.isInteger(end) && start <= end) {
        const boundedStart = Math.max(1, start);
        const boundedEnd = Math.min(totalLines, end);
        for (let i = boundedStart; i <= boundedEnd; i++) {
          lines.add(i);
        }
      }
    } else {
      const line = Number(part);
      if (Number.isInteger(line) && line >= 1 && line <= totalLines) {
        lines.add(line);
      }
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
      const infostring = token.lang || '';
      const lang = infostring
        .replace(HIGHLIGHT_META_RE, '')
        .trim()
        .toLowerCase();

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

      const html = (Renderer.prototype.code as any).call(this, {
        ...token,
        lang
      });

      const totalLines = token.text.replace(/\n$/, '').split('\n').length;
      const highlightedLines = parseHighlightedLines(infostring, totalLines);
      if (!highlightedLines.length) return html;

      return html.replace(
        /^<pre>/,
        `<pre data-highlight-lines="${highlightedLines.join(',')}">`
      );
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
              checkboxSvg = `<span class="task-checkbox status-done flex h-[1.375rem] w-4 shrink-0 items-center justify-center text-success translate-y-[0.5px]" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-check size-4 shrink-0 text-success"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg></span>`;
            } else if (statusChar === '*') {
              checkboxSvg = `<span class="task-checkbox status-wip flex h-[1.375rem] w-4 shrink-0 items-center justify-center text-warning-strong translate-y-[0.5px]" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-asterisk size-4 shrink-0 text-warning-strong"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 8v8"/><path d="m8.5 14 7-4"/><path d="m8.5 10 7 4"/></svg></span>`;
            } else if (statusChar === '/') {
              checkboxSvg = `<span class="task-checkbox status-failed flex h-[1.375rem] w-4 shrink-0 items-center justify-center text-danger translate-y-[0.5px]" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-x size-4 shrink-0 text-danger"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg></span>`;
            } else if (statusChar === '-') {
              checkboxSvg = `<span class="task-checkbox status-skipped flex h-[1.375rem] w-4 shrink-0 items-center justify-center text-text-muted translate-y-[0.5px]" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-minus size-4 shrink-0 text-text-muted"><rect width="18" height="18" x="3" y="3" rx="2"/><line x1="8" x2="16" y1="12" y2="12"/></svg></span>`;
              textDecorationClass = ' line-through opacity-75';
            } else if (statusChar === '!') {
              checkboxSvg = `<span class="task-checkbox status-important flex h-[1.375rem] w-4 shrink-0 items-center justify-center text-copilot translate-y-[0.5px]" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-alert size-4 shrink-0 text-copilot"><rect width="18" height="18" x="3" y="3" rx="2"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg></span>`;
            } else if (statusChar === '?') {
              checkboxSvg = `<span class="task-checkbox status-question flex h-[1.375rem] w-4 shrink-0 items-center justify-center text-a11y-focus translate-y-[0.5px]" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-square size-4 shrink-0 text-a11y-focus"><rect width="18" height="18" x="3" y="3" rx="2"/><rect width="8" height="8" x="8" y="8" rx="1"/></svg></span>`;
            } else {
              checkboxSvg = `<span class="task-checkbox status-pending flex h-[1.375rem] w-4 shrink-0 items-center justify-center text-text-muted translate-y-[0.5px]" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square size-4 shrink-0 text-text-muted"><rect width="18" height="18" x="3" y="3" rx="2"/></svg></span>`;
            }

            const rawText = this.parser
              .parse(item.tokens)
              .replace(/<input\s+[^>]*type="checkbox"[^>]*>/gi, '')
              .replace(
                /^(?:<p\b[^>]*>)?\s*\[[ xX*/!\-?]]\s*(?:<\/p>)?/i,
                match => {
                  return match.startsWith('<p') && !match.endsWith('</p>') ?
                      '<p>'
                    : '';
                }
              )
              .trim();
            const text = cleanListItemHtml(rawText);
            body += `<li class="task-list-item my-1 flex items-start gap-2 leading-normal">${checkboxSvg}<div class="task-content min-w-0 flex-1 leading-normal${textDecorationClass}">${text}</div></li>\n`;
          } else {
            const rawText = this.parser.parse(item.tokens).trim();
            const text = cleanListItemHtml(rawText);
            const dotSvg = `<span class="ul-dot flex h-[1.375rem] w-2.5 shrink-0 items-center justify-center text-text-secondary translate-y-[0.5px]" aria-hidden="true"><span class="size-1.5 rounded-full bg-text-secondary"></span></span>`;
            body += `<li class="ul-list-item my-1 flex items-start gap-1.5 leading-normal">${dotSvg}<div class="ul-content min-w-0 flex-1 leading-normal">${text}</div></li>\n`;
          }
        }
      }
      const type = ordered ? 'ol' : 'ul';
      const startAttr = ordered && start !== 1 ? ` start="${start}"` : '';
      const listClass =
        ordered ?
          'ol-list my-2 list-decimal space-y-1 pl-6'
        : 'ul-list my-2 flex list-none flex-col gap-1 pl-0';
      return `<${type}${startAttr} class="${listClass}">\n${body}</${type}>\n`;
    },
    link(token) {
      const href = (token.href || '').trim();
      const title = token.title ? ` title="${token.title}"` : '';
      const text = this.parser.parseInline(token.tokens);
      const isSafe = !/^(?:javascript|data|vbscript):/i.test(href);
      const safeHref = isSafe ? href : '#';
      const isOwnDomain = /^https?:\/\/(?:www\.)?fkp\.my\.id(?:\/|$)/i.test(
        safeHref
      );
      const isExternal = /^https?:\/\//i.test(safeHref) && !isOwnDomain;
      if (!isExternal) {
        return `<a href="${safeHref}"${title}>${text}</a>`;
      }
      return `<a href="${safeHref}"${title} target="_blank" rel="noopener noreferrer" class="markdown-external-link inline">${text}${LUCIDE_ICON_SVGS['external-link']}</a>`;
    }
  }
});

markdownParser.use(markedFootnote({refMarkers: true}));

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

export const FENCED_CODE_RE =
  /^[ \t]*(`{3,}|~{3,})[^\n]*\r?\n[\s\S]*?\r?\n[ \t]*\1[ \t]*$/gm;

export const INLINE_CODE_RE = /(`+)(?:[^\n`]|`(?!\1))+\1/g;

export const MATH_BLOCK_RE = /(?:\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$)/g;

export const MATH_INLINE_RE =
  /(?:\\\(([\s\S]+?)\\\)|(?<!\\)\$((?!\s)[^$\n]+?(?!\s))\$)/g;

export const DIRECTIVE_OPEN_RE =
  /^[ \t]*:{2,}[a-zA-Z][a-zA-Z-]*(?:\{[^}\n]*\})?[ \t]*$/gm;

export const DIRECTIVE_CLOSE_RE = /^[ \t]*:{2,}[ \t]*$/gm;

export const ALERT_MARKER_RE = /\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/gi;

export const PLACEHOLDER_RE = /@@[A-Z_]+_\d+@@/g;

const MAX_RESTORE_PASSES = 10;

export function restoreAllPlaceholders(
  text: string,
  store: Map<string, string>
): string {
  let result = text;
  for (let pass = 0; pass < MAX_RESTORE_PASSES; pass++) {
    let changed = false;
    for (const [key, value] of store.entries()) {
      if (!result.includes(key)) continue;
      result = result.replaceAll(key, () => value);
      changed = true;
    }
    if (!changed) break;
  }
  return result;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const IGNORE_RENDER_RE =
  /^[ \t]*:::ignore-render[^\n]*\r?\n([\s\S]*?)\r?\n[ \t]*:::[ \t]*$/gim;

export function extractIgnoreRenderBlocks(
  markdown: string,
  store: Map<string, string>
): string {
  return markdown.replace(IGNORE_RENDER_RE, (_, content: string) => {
    const key = `@@IGNORE_RENDER_${store.size}@@`;
    store.set(key, `<pre>${escapeHtml(content.trim())}</pre>`);
    return `\n\n${key}\n\n`;
  });
}

const POST_CONFIG_RE =
  /^:::config[^\n]*\r?\n([\s\S]*?)\r?\n:::[ \t]*(?=\r?\n|$)/i;

export function extractPostConfig(markdown: string): {
  config: Record<string, string>;
  body: string;
} {
  const match = markdown.match(POST_CONFIG_RE);
  if (!match) return {config: {}, body: markdown};

  const config: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    if (key) config[key] = value;
  }

  return {config, body: markdown.slice(match[0].length).replace(/^\r?\n/, '')};
}

export const IGNORE_TRANSLATE_RE =
  /^[ \t]*:::ignore-translate[^\n]*\r?\n([\s\S]*?)\r?\n[ \t]*:::[ \t]*$/gim;

const LOCALE_BLOCK_RE =
  /^[ \t]*:::locale\{only="([^"]+)"\}[^\n]*\r?\n([\s\S]*?)\r?\n[ \t]*:::[ \t]*$/gim;

export function filterLocaleBlocks(markdown: string, locale?: string): string {
  if (!markdown) return '';

  const placeholders = new Map<string, string>();
  let text = protectWithPlaceholders(
    markdown,
    FENCED_CODE_RE,
    'FENCED_CODE',
    placeholders
  );
  text = protectWithPlaceholders(
    text,
    INLINE_CODE_RE,
    'INLINE_CODE',
    placeholders
  );

  text = text.replace(LOCALE_BLOCK_RE, (_, only: string, content: string) => {
    const allowedLocales = only.split(',').map(l => l.trim().toLowerCase());
    const matches = !locale || allowedLocales.includes(locale.toLowerCase());
    return matches ? content.trim() : '';
  });

  return restoreAllPlaceholders(text, placeholders);
}

const TRANSLATE_OVERRIDE_OUTER_RE =
  /^[ \t]*:::translate-override[^\n]*\r?\n([\s\S]*?)\r?\n[ \t]*:::[ \t]*$/gim;
const TRANSLATE_OVERRIDE_ENTRY_RE =
  /^[ \t]*::override\{locale="([^"]+)"\}[^\n]*\r?\n([\s\S]*?)(?=\r?\n[ \t]*::override|(?![\s\S]))/gim;

export function replaceTranslateOverrideBlocks(
  markdown: string,
  transform: (defaultText: string, overrides: Record<string, string>) => string
): string {
  return markdown.replace(TRANSLATE_OVERRIDE_OUTER_RE, (_, content: string) => {
    const firstEntryMatch = content.match(/^[ \t]*::override\{locale="/im);
    const defaultText =
      firstEntryMatch ? content.slice(0, firstEntryMatch.index) : content;

    const overrides: Record<string, string> = {};
    let entryMatch;
    TRANSLATE_OVERRIDE_ENTRY_RE.lastIndex = 0;
    while ((entryMatch = TRANSLATE_OVERRIDE_ENTRY_RE.exec(content)) !== null) {
      overrides[entryMatch[1].trim().toLowerCase()] = entryMatch[2].trim();
    }

    return transform(defaultText.trim(), overrides);
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

export function extractAndRenderMath(
  markdown: string,
  mathStore: Map<string, string>
): string {
  if (!markdown) return '';

  const codePlaceholders = new Map<string, string>();
  let text = protectWithPlaceholders(
    markdown,
    FENCED_CODE_RE,
    'FENCED_CODE',
    codePlaceholders
  );
  text = protectWithPlaceholders(
    text,
    INLINE_CODE_RE,
    'INLINE_CODE',
    codePlaceholders
  );

  let mathIndex = 0;

  text = text.replace(MATH_BLOCK_RE, (_, p1, p2) => {
    const math = decodeMathEntities((p1 || p2 || '').trim());
    let rendered: string;
    try {
      const html = katex.renderToString(math, {
        displayMode: true,
        throwOnError: false
      });
      rendered = `<div class="katex-block my-4 flex items-center justify-center overflow-x-auto py-2">${html}</div>`;
    } catch {
      rendered = `<div class="katex-error text-danger font-mono text-xs">${math}</div>`;
    }
    const key = `@@@MATH_BLOCK_${mathIndex++}@@@`;
    mathStore.set(key, rendered);
    return `\n\n${key}\n\n`;
  });

  text = text.replace(MATH_INLINE_RE, (_, p1, p2) => {
    const math = decodeMathEntities((p1 || p2 || '').trim());
    let rendered: string;
    try {
      rendered = katex.renderToString(math, {
        displayMode: false,
        throwOnError: false
      });
    } catch {
      rendered = `$${math}$`;
    }
    const key = `@@@MATH_INLINE_${mathIndex++}@@@`;
    mathStore.set(key, rendered);
    return key;
  });

  text = restoreAllPlaceholders(text, codePlaceholders);
  return text;
}

export function parseMathFormulas(text: string): string {
  if (!text) return '';

  const placeholders = new Map<string, string>();
  let output = protectWithPlaceholders(
    text,
    /<pre[\s\S]*?<\/pre>/gi,
    'HTML_PRE',
    placeholders
  );
  output = protectWithPlaceholders(
    output,
    /<code[\s\S]*?<\/code>/gi,
    'HTML_CODE',
    placeholders
  );
  output = protectWithPlaceholders(
    output,
    /<svg[\s\S]*?<\/svg>/gi,
    'HTML_SVG',
    placeholders
  );
  output = protectWithPlaceholders(
    output,
    /<div class="mermaid-raw-code"[\s\S]*?<\/div>/gi,
    'MERMAID_RAW',
    placeholders
  );

  output = output.replace(MATH_BLOCK_RE, (_, p1, p2) => {
    const math = decodeMathEntities((p1 || p2 || '').trim());
    try {
      const rendered = katex.renderToString(math, {
        displayMode: true,
        throwOnError: false
      });
      return `<div class="katex-block my-4 flex items-center justify-center overflow-x-auto py-2">${rendered}</div>`;
    } catch {
      return `<div class="katex-error text-danger font-mono text-xs">${math}</div>`;
    }
  });

  output = output.replace(MATH_INLINE_RE, (_, p1, p2) => {
    const math = decodeMathEntities((p1 || p2 || '').trim());
    try {
      return katex.renderToString(math, {
        displayMode: false,
        throwOnError: false
      });
    } catch {
      return `$${math}$`;
    }
  });

  return restoreAllPlaceholders(output, placeholders);
}

const LUCIDE_ICON_SVGS: Record<string, string> = {
  package:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package size-3.5 shrink-0"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/></svg>',
  terminal:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-terminal size-3.5 shrink-0"><path d="M12 19h8"/><path d="m4 17 6-6-6-6"/></svg>',
  code: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-code size-3.5 shrink-0"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></svg>',
  database:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-database size-3.5 shrink-0"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>',
  rocket:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-rocket size-3.5 shrink-0"><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"/><path d="M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05"/></svg>',
  settings:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings size-3.5 shrink-0"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>',
  'git-branch':
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-git-branch size-3.5 shrink-0"><path d="M15 6a9 9 0 0 0-9 9V3"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/></svg>',
  cloud:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cloud size-3.5 shrink-0"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>',
  layers:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-layers size-3.5 shrink-0"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/></svg>',
  zap: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-zap size-3.5 shrink-0"><path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"/></svg>',
  'book-open':
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open size-3.5 shrink-0"><path d="M12 5v16"/><path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"/></svg>',
  info: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-info size-3.5 shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  star: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-star size-3.5 shrink-0"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>',
  'square-arrow-out-up-right':
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-arrow-out-up-right size-3.5 shrink-0"><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/><path d="m21 3-9 9"/><path d="M15 3h6v6"/></svg>',
  'external-link':
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-external-link inline-block ml-0.5 size-2.5 align-baseline shrink-0"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>'
};

function resolveDirectiveIcon(name: string): string {
  const key = name.trim().toLowerCase();
  const lucideSvg = LUCIDE_ICON_SVGS[key];
  if (lucideSvg) return lucideSvg;
  return `<i class="bi bi-${key} shrink-0" aria-hidden="true"></i>`;
}

export function parseContainers(markdown: string): string {
  if (!markdown) return '';

  const placeholders = new Map<string, string>();
  let text = protectWithPlaceholders(
    markdown,
    FENCED_CODE_RE,
    'FENCED_CODE',
    placeholders
  );
  text = protectWithPlaceholders(
    text,
    INLINE_CODE_RE,
    'INLINE_CODE',
    placeholders
  );

  text = text.replace(
    /^[ \t]*:::(?:steps|step)[^\n]*\r?\n([\s\S]*?)\r?\n[ \t]*:::[ \t]*$/gim,
    (_, content) => {
      return `<div class="markdown-steps-container my-6 ml-0 space-y-0">\n\n${content.trim()}\n\n</div>`;
    }
  );

  text = text.replace(
    /^[ \t]*:::tabs(?:\{key="([^"]+)"\})?[^\n]*\r?\n([\s\S]*?)\r?\n[ \t]*:::[ \t]*$/gim,
    (_, groupKey, content) => {
      const tabs: Array<{label: string; icon?: string; content: string}> = [];
      const tabRegex =
        /^[ \t]*::tab\{label="([^"]+)"(?:[,\s]+icon="([^"]+)")?\}[^\n]*\r?\n([\s\S]*?)(?=\r?\n[ \t]*::tab|\r?\n[ \t]*::[ \t]*$|(?![\s\S]))/gim;
      let match;
      while ((match = tabRegex.exec(content)) !== null) {
        const rawTabContent = (match[3] || '')
          .replace(/\r?\n[ \t]*::[ \t]*$/g, '')
          .trim();
        tabs.push({label: match[1], icon: match[2], content: rawTabContent});
      }

      if (tabs.length === 0) {
        const fallbackRegex =
          /::tab\{label="([^"]+)"(?:[,\s]+icon="([^"]+)")?\}\s*([\s\S]*?)(?=(?:::tab|::|\s*$))/gi;
        while ((match = fallbackRegex.exec(content)) !== null) {
          const rawTabContent = (match[3] || '')
            .replace(/\r?\n[ \t]*::[ \t]*$/g, '')
            .trim();
          tabs.push({label: match[1], icon: match[2], content: rawTabContent});
        }
      }

      if (tabs.length === 0) return content;

      const headerButtons = tabs
        .map((tab, idx) => {
          const isSelected = idx === 0;
          const iconMarkup = tab.icon ? resolveDirectiveIcon(tab.icon) : '';
          return `<button type="button" role="tab" class="markdown-tab-button relative -mb-px inline-flex shrink-0 items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-[2.5px] transition-all cursor-pointer select-none ${
            isSelected ?
              'active-tab text-accent border-b-accent font-bold'
            : 'text-text-muted border-b-transparent hover:text-text-primary'
          }" data-tab-label="${tab.label}" aria-selected="${isSelected ? 'true' : 'false'}">${iconMarkup}${tab.label}</button>`;
        })
        .join('');

      const panels = tabs
        .map((tab, idx) => {
          const isSelected = idx === 0;
          return `<div role="tabpanel" class="markdown-tab-panel ${isSelected ? 'block' : 'hidden'}" ${isSelected ? '' : 'hidden'}>\n\n${tab.content}\n\n</div>`;
        })
        .join('');

      const groupAttr = groupKey ? ` data-tab-group-key="${groupKey}"` : '';

      return `<div class="markdown-tabs-container group/codemin my-6 rounded-md border border-border-subtle shadow-2xs"${groupAttr}>
  <div class="markdown-tabs-header hljs relative flex min-h-8 items-end justify-between rounded-t-md border-b border-border-subtle px-3 pt-0 pb-0 select-none" role="tablist">
    <div class="markdown-tabs-nav flex min-w-0 flex-1 items-end gap-1.5 m-0 p-0 overflow-x-auto scrollbar-none [-ms-overflow-style:none]">
      ${headerButtons}
    </div>
    <div class="markdown-tabs-actions flex shrink-0 items-center gap-1 ml-2 self-center"></div>
  </div>
  <div class="markdown-tabs-body rounded-b-md">
    ${panels}
  </div>
</div>`;
    }
  );

  text = text.replace(
    /^[ \t]*(:{3,})tab-group(?:\{key="([^"]+)"\})?[^\n]*\r?\n([\s\S]*?)\r?\n[ \t]*\1[ \t]*$/gim,
    (_, _colons, groupKey, content) => {
      const tabs: Array<{label: string; icon?: string; content: string}> = [];
      const tabRegex =
        /^[ \t]*::tab\{label="([^"]+)"(?:[,\s]+icon="([^"]+)")?\}[^\n]*\r?\n([\s\S]*?)(?=\r?\n[ \t]*::tab|\r?\n[ \t]*::[ \t]*$|(?![\s\S]))/gim;
      let match;
      while ((match = tabRegex.exec(content)) !== null) {
        const rawTabContent = (match[3] || '')
          .replace(/\r?\n[ \t]*::[ \t]*$/g, '')
          .trim();
        tabs.push({label: match[1], icon: match[2], content: rawTabContent});
      }

      if (tabs.length === 0) {
        const fallbackRegex =
          /::tab\{label="([^"]+)"(?:[,\s]+icon="([^"]+)")?\}\s*([\s\S]*?)(?=(?:::tab|::|\s*$))/gi;
        while ((match = fallbackRegex.exec(content)) !== null) {
          const rawTabContent = (match[3] || '')
            .replace(/\r?\n[ \t]*::[ \t]*$/g, '')
            .trim();
          tabs.push({label: match[1], icon: match[2], content: rawTabContent});
        }
      }

      if (tabs.length === 0) return content;

      const headerButtons = tabs
        .map((tab, idx) => {
          const isSelected = idx === 0;
          const iconMarkup = tab.icon ? resolveDirectiveIcon(tab.icon) : '';
          return `<button type="button" role="tab" class="markdown-tab-button relative -mb-px inline-flex shrink-0 items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-[2.5px] transition-all cursor-pointer select-none ${
            isSelected ?
              'active-tab text-accent border-b-accent font-bold'
            : 'text-text-muted border-b-transparent hover:text-text-primary'
          }" data-tab-label="${tab.label}" aria-selected="${isSelected ? 'true' : 'false'}">${iconMarkup}${tab.label}</button>`;
        })
        .join('');

      const panels = tabs
        .map((tab, idx) => {
          const isSelected = idx === 0;
          return `<div role="tabpanel" class="markdown-tab-panel ${isSelected ? 'block' : 'hidden'}" ${isSelected ? '' : 'hidden'}>\n\n${tab.content}\n\n</div>`;
        })
        .join('');

      const groupAttr = groupKey ? ` data-tab-group-key="${groupKey}"` : '';

      return `<div class="markdown-tab-group my-6"${groupAttr}>
  <div class="markdown-tab-group-header relative flex min-h-[2rem] items-end border-b border-border-subtle select-none" role="tablist">
    <div class="markdown-tab-group-nav flex min-w-0 flex-1 items-end gap-1.5 m-0 p-0 overflow-x-auto scrollbar-none [-ms-overflow-style:none]">
      ${headerButtons}
    </div>
  </div>
  <div class="markdown-tab-group-body pt-2">
    ${panels}
  </div>
</div>`;
    }
  );

  text = text.replace(IGNORE_TRANSLATE_RE, (_, content: string) => content);

  text = replaceTranslateOverrideBlocks(text, defaultText => defaultText);

  text = text.replace(
    /^[ \t]*:::embed\{url="([^"]+)"\}[ \t]*$/gim,
    (_, url: string) => {
      const youtubeMatch = url.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/i
      );
      const codepenMatch = url.match(/codepen\.io\/([\w-]+)\/pen\/([\w-]+)/i);

      let embedUrl: string | null = null;
      if (youtubeMatch) {
        embedUrl = `https://www.youtube.com/embed/${youtubeMatch[1]}`;
      } else if (codepenMatch) {
        embedUrl = `https://codepen.io/${codepenMatch[1]}/embed/${codepenMatch[2]}?default-tab=result`;
      }

      if (!embedUrl) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
      }

      return `<div class="markdown-embed-container my-6 aspect-video w-full overflow-hidden rounded-md glass-card border border-border-subtle/60 shadow-md backdrop-blur-md"><iframe src="${embedUrl}" loading="lazy" allowfullscreen class="h-full w-full" title="Embedded content"></iframe></div>`;
    }
  );

  text = text.replace(
    /^[ \t]*:::callout\{title="([^"]+)"(?:[,\s]+icon="([^"]+)")?\}[^\n]*\r?\n([\s\S]*?)\r?\n[ \t]*:::[ \t]*$/gim,
    (_, title: string, icon: string | undefined, content: string) => {
      const iconMarkup = icon ? resolveDirectiveIcon(icon) : '';
      const titleSpan = `<span>${title}</span>`;
      return `<div class="markdown-callout">
  <div class="markdown-callout-title leading-none">
    ${iconMarkup}${titleSpan}
  </div>
  <div class="markdown-callout-content">\n\n${content.trim()}\n\n</div>
</div>`;
    }
  );

  text = text.replace(/^[ \t]*\d+\.[ \t]+(\[\^[\w-]+\]:.*)$/gm, '$1');

  return restoreAllPlaceholders(text, placeholders);
}

export function parseMarkdownAlerts(html: string): string {
  if (!html) return '';

  return html.replace(
    /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
    (match, innerContent: string) => {
      const alertMatch = innerContent.match(
        /^\s*(?:<p\b[^>]*>)?\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s*<\/p>|\s*<br\s*\/?>)?/i
      );
      if (!alertMatch) return match;

      const type = alertMatch[1].toLowerCase() as
        'note' | 'tip' | 'important' | 'warning' | 'caution';

      const config: Record<string, {title: string; svg: string}> = {
        note: {
          title: 'Note',
          svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-info size-4 shrink-0 -translate-y-[6%]"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
        },
        tip: {
          title: 'Tip',
          svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lightbulb size-4 shrink-0 -translate-y-[6%]"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>'
        },
        important: {
          title: 'Important',
          svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square-warning size-4 shrink-0 -translate-y-[6%]"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v2"/><path d="M12 13h.01"/></svg>'
        },
        warning: {
          title: 'Warning',
          svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alert-triangle size-4 shrink-0 -translate-y-[6%]"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>'
        },
        caution: {
          title: 'Caution',
          svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-alert size-4 shrink-0 -translate-y-[6%]"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>'
        }
      };

      const alertConfig = config[type];
      let content = innerContent.slice(alertMatch[0].length).trim();
      content = content.replace(/^(?:<br\s*\/?>|&gt;|>|\s)+/gi, '').trim();

      const matchedText = alertMatch[0];
      const hadOpenP = /<p\b/i.test(matchedText);
      const hadCloseP = /<\/p>/i.test(matchedText);
      if (hadOpenP && !hadCloseP) {
        content = `<p>${content}`;
      }

      if (content && !/^<[a-z0-9]+/i.test(content)) {
        content = `<p>${content}</p>`;
      }

      return `<div class="markdown-alert markdown-alert-${type}">
  <div class="markdown-alert-title leading-none">
    ${alertConfig.svg}
    <span>${alertConfig.title}</span>
  </div>
  <div class="markdown-alert-content">
    ${content}
  </div>
</div>`;
    }
  );
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
          const summaryMatch = inner.match(
            /^\s*<summary([^>]*)>([\s\S]*?)<\/summary>/i
          );
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
 <summary${summaryAttrs} class="markdown-details-summary flex min-h-[2.25rem] cursor-pointer list-none items-center justify-between gap-2 border-b border-transparent group-open:border-border-subtle dark:group-open:border-white/10 px-3.5 py-1.5 font-medium text-sm text-text-primary hover:bg-surface-hover/50 transition-colors select-none [&::-webkit-details-marker]:hidden">
 <span class="inline-flex items-center gap-2">
 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-list-collapse size-4 shrink-0 text-text-primary"><path d="M10 5h11"/><path d="M10 12h11"/><path d="M10 19h11"/><path d="m3 10 3-3-3-3"/><path d="m3 20 3-3-3-3"/></svg>
 <span class="markdown-details-title translate-y-[1px] font-medium text-sm text-text-primary leading-none">${summaryTitle}</span>
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
              (
                _match: string,
                _tag: string,
                attrs: string,
                content: string
              ) => {
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
              : '';
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

export async function renderMarkdown(
  markdown: string,
  locale?: string,
  supabaseClient?: any
): Promise<string> {
  const {body} = extractPostConfig(markdown);
  const {raw: defineRaw, body: bodyAfterDefine} = extractDefineBlock(body);
  const apiRegistry = createApiRegistry(supabaseClient);
  const {scope} = await evaluateDefineBlock(defineRaw, apiRegistry);
  const ignoreRenderPlaceholders = new Map<string, string>();
  const withRawBlocksExtracted = extractIgnoreRenderBlocks(
    bodyAfterDefine,
    ignoreRenderPlaceholders
  );
  const withLocaleFiltered = filterLocaleBlocks(withRawBlocksExtracted, locale);
  const interpolationPlaceholders = new Map<string, string>();
  const withInterpolationProtected = protectInterpolationTokens(
    withLocaleFiltered,
    interpolationPlaceholders
  );
  const mathPlaceholders = new Map<string, string>();
  const withMathExtracted = extractAndRenderMath(
    withInterpolationProtected,
    mathPlaceholders
  );
  const {output: withInterpolated} = await resolveProtectedInterpolationTokens(
    withMathExtracted,
    interpolationPlaceholders,
    scope,
    apiRegistry
  );
  const withContainers = parseContainers(withInterpolated);
  const rawHtml = await markdownParser.parse(withContainers);
  const withAlerts = parseMarkdownAlerts(rawHtml);
  const withDetails = parseDetailsBlocks(withAlerts);
  const withSteps = parseSteps(withDetails);
  const withFootnotes = formatFootnoteReferences(withSteps);
  const withMathRestored = restoreAllPlaceholders(
    withFootnotes,
    mathPlaceholders
  );
  const withUnwrappedBlocks = withMathRestored
    .replace(/<p>\s*(<div class="katex-block[\s\S]*?<\/div>)\s*<\/p>/gi, '$1')
    .replace(/<p>\s*(@@IGNORE_RENDER_\d+@@)\s*<\/p>/gi, '$1');
  return restoreAllPlaceholders(withUnwrappedBlocks, ignoreRenderPlaceholders);
}

export const marked = markdownParser;

export function injectHeadingIds(html: string): string {
  let index = 0;
  const usedIds = new Set<string>();

  return html.replace(
    /<h([1-6])([^>]*)>(.*?)<\/h\1>/gi,
    (match, level, attrs, content) => {
      if (attrs.includes('id=')) {
        const idMatch = attrs.match(/id="([^"]*)"/);
        if (idMatch) {
          usedIds.add(idMatch[1]);
        }
        return match;
      }

      const text = content.replace(/<[^>]*>/g, '');
      const baseId =
        text ?
          text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
        : `heading-${index++}`;

      let id = baseId;
      let counter = 1;
      while (usedIds.has(id)) {
        id = `${baseId}-${counter++}`;
      }
      usedIds.add(id);

      return `<h${level}${attrs} id="${id}">${content}</h${level}>`;
    }
  );
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
  const headingRegex =
    /<h([2-6])\b[^>]*\bid="([^"]*)"[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    const id = match[2];
    let content = match[3]
      .replace(
        /<a\b[^>]*class="[^"]*anchor-link[^"]*"[^>]*>[\s\S]*?<\/a>/gi,
        ''
      )
      .trim();
    content = content.replace(
      /<(?!code\b|\/code|kbd\b|\/kbd|em\b|\/em|strong\b|\/strong|sub\b|\/sub|sup\b|\/sup)[^>]+>/gi,
      ''
    );
    const text = decodeHtmlEntities(content);
    headings.push({id, text, level});
  }
  return headings;
}

export async function prepareMarkdownPage(
  markdown: string,
  locale?: string,
  supabaseClient?: any
): Promise<{html: string; headings: HeadingItem[]}> {
  const rawHtml = await renderMarkdown(markdown, locale, supabaseClient);
  const html = injectHeadingIds(rawHtml);
  const headings = extractHeadings(html);
  return {html, headings};
}
