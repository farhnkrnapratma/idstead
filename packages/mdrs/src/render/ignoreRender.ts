import { placeholderKey, replaceLineBlocks } from '../placeholders';
import { escapeHtml } from './attrs';

const IGNORE_RENDER_OPEN_RE = /^[ \t]*(:{3,})ignore-render\b.*$/i;

const COLON_CLOSE_RE = /^[ \t]*(:{3,})[ \t]*$/;

export function extractIgnoreRenderBlocks(markdown: string, store: Map<string, string>): string {
    return replaceLineBlocks(
        markdown,
        line => line.match(IGNORE_RENDER_OPEN_RE),
        line => line.match(COLON_CLOSE_RE)?.[1] ?? null,
        match => match[1],
        (_match, content) => {
            const key = placeholderKey('IGNORE_RENDER', store.size);
            store.set(key, `<pre>${escapeHtml(content.trim())}</pre>`);
            return `\n\n${key}\n\n`;
        }
    );
}
