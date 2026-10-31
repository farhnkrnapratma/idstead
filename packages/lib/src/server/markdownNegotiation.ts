import { NodeHtmlMarkdown } from 'node-html-markdown';
import { decodeHtmlEntities } from '@idstead/domain/entities.ts';
import { isLegalSlug } from '@idstead/domain/legal.ts';

const IGNORED_ELEMENTS = [
    'script',
    'style',
    'noscript',
    'template',
    'svg',
    'canvas',
    'nav',
    'footer',
    'aside',
    'form',
    'button',
    'dialog',
    'iframe',
    'select',
    'input',
    'textarea'
];

const converter = new NodeHtmlMarkdown({
    ignore: IGNORED_ELEMENTS,
    bulletMarker: '-',
    emDelimiter: '*',
    maxConsecutiveNewlines: 2
});

const DROPPED_HEADERS = [
    'content-length',
    'content-encoding',
    'etag',
    'last-modified',
    'content-security-policy'
];

function weight(params: string[]): number {
    const q = params.find(param => param.startsWith('q='));
    if (!q) return 1;
    const value = Number(q.slice(2));
    return Number.isFinite(value) ? value : 0;
}

export function prefersMarkdown(accept: string | null): boolean {
    if (!accept) return false;
    let markdown = 0;
    let html = 0;
    for (const range of accept.toLowerCase().split(',')) {
        const [type, ...params] = range.split(';').map(part => part.trim());
        if (type === 'text/markdown') markdown = Math.max(markdown, weight(params));
        else if (type === 'text/html') html = Math.max(html, weight(params));
    }
    return markdown > 0 && markdown >= html;
}

export function negotiablePath(pathname: string): boolean {
    return (
        !pathname.startsWith('/api/')
        && !pathname.startsWith('/.well-known/')
        && !/\.[a-z0-9]+$/i.test(pathname)
    );
}

export function markdownSourcePath(pathname: string): string | null {
    const path = pathname.replace(/\/+$/, '');
    if (/^\/blog\/[^/.]+$/.test(path) || isLegalSlug(path.slice(1))) return `${path}.md`;
    return null;
}

function metaContent(html: string, name: string): string {
    const tag = html.match(new RegExp(`<meta[^>]+name="${name}"[^>]*>`, 'i'))?.[0] ?? '';
    return decodeHtmlEntities(tag.match(/content="([^"]*)"/i)?.[1] ?? '').trim();
}

export function htmlToMarkdown(html: string): string {
    const title = decodeHtmlEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '').trim();
    const description = metaContent(html, 'description');
    const main =
        html.match(/<main\b[^>]*>([\s\S]*)<\/main>/i)?.[1]
        ?? html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1]
        ?? html;
    const frontmatter = [
        title && `title: ${JSON.stringify(title)}`,
        description && `description: ${JSON.stringify(description)}`
    ].filter(Boolean);
    const body = converter
        .translate(main.replace(/<img\b[^>]*\balt=""[^>]*>/gi, ''))
        .replace(/\[[ \t]+([^\]\n]*?)[ \t]+\]\(/g, '[$1](')
        .trim();
    return frontmatter.length ? `---\n${frontmatter.join('\n')}\n---\n\n${body}\n` : `${body}\n`;
}

export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

export function markdownResponse(markdown: string, source: Response, method: string): Response {
    const headers = new Headers(source.headers);
    for (const name of DROPPED_HEADERS) headers.delete(name);
    headers.set('Content-Type', 'text/markdown; charset=utf-8');
    headers.set('Vary', 'Accept');
    headers.set('x-markdown-tokens', String(estimateTokens(markdown)));
    return new Response(method === 'HEAD' ? null : markdown, { status: source.status, headers });
}

export function varyOnAccept(response: Response): Response {
    if (response.headers.get('content-type')?.includes('text/html'))
        response.headers.append('Vary', 'Accept');
    return response;
}
