import { placeholderKey, replaceLineBlocks } from '../placeholders';
import { escapeHtml } from './attrs';

const VERBATIM_OPEN_RE = /^[ \t]*(:{3,})verbatim\b.*$/i;

const COLON_CLOSE_RE = /^[ \t]*(:{3,})[ \t]*$/;

export function extractVerbatimBlocks(markdown: string, store: Map<string, string>): string {
    return replaceLineBlocks(
        markdown,
        line => line.match(VERBATIM_OPEN_RE),
        line => line.match(COLON_CLOSE_RE)?.[1] ?? null,
        match => match[1],
        (_match, content) => {
            const key = placeholderKey('VERBATIM', store.size);
            store.set(key, `<pre>${escapeHtml(content.trim())}</pre>`);
            return `\n\n${key}\n\n`;
        }
    );
}

export function protectVerbatimBlocks(markdown: string, store: Map<string, string>): string {
    return replaceLineBlocks(
        markdown,
        line => line.match(VERBATIM_OPEN_RE),
        line => line.match(COLON_CLOSE_RE)?.[1] ?? null,
        match => match[1],
        (_match, _content, block) => {
            const key = placeholderKey('VERBATIM', store.size);
            store.set(key, block);
            return key;
        }
    );
}
