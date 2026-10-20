export const ATTR_RE = /([a-zA-Z][\w-]*)="((?:[^"\\]|\\.)*)"/g;

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

export function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
