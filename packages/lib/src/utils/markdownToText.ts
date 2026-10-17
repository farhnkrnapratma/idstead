import { extractFrontmatter } from '../frontmatter';
import { stripPlaceholderChars } from '../placeholders';

function decodeHtmlEntities(str: string): string {
    return str
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ');
}

export function markdownToPlainText(markdown: string): string {
    if (!markdown) return '';

    let text = extractFrontmatter(stripPlaceholderChars(markdown)).body;
    const kept: string[] = [];
    const keep = (value: string) => `\uE000${kept.push(value) - 1}\uE001`;

    text = text.replace(/<!--[\s\S]*?-->/g, '');
    text = text.replace(/(`{3,}|~{3,})[^\n]*\n([\s\S]*?)\1/g, (_, __, body: string) => keep(body));
    text = text.replace(
        /^[ \t]*:::math[ \t]*\n([\s\S]*?)\n[ \t]*:::[ \t]*$/gim,
        (_, body: string) => keep(body)
    );
    text = text.replace(/\$\$([^\n]+?)\$\$/g, (_, formula: string) => keep(formula.trim()));
    text = text.replace(/`([^`]+)`/g, '$1');
    text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    text = text.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');
    text = text.replace(
        /^[ \t]*:{2,3}(?:callout|details|tab)\b[^\n]*?\b(?:title|summary|label)="([^"]*)"[^\n]*$/gm,
        '$1'
    );
    text = text.replace(/^[ \t]*:{2,}(?:[a-zA-Z][a-zA-Z-]*(?:[ \t][^\n]*)?)?[ \t]*$/gm, '');
    text = text.replace(/^#{1,6}\s+(.+)$/gm, '$1');
    text = text.replace(/^>\s?(.*)$/gm, '$1');
    text = text.replace(/^[-*_]{3,}\s*$/gm, '');
    text = text.replace(/^(\s*)(?:[*+-]|\d+\.)\s+(.+)$/gm, '$1$2');
    text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
    text = text.replace(/(\*|_)(.*?)\1/g, '$2');
    text = text.replace(/~~(.*?)~~/g, '$1');
    text = text.replace(/<[^>]*>/g, '');
    text = decodeHtmlEntities(text);
    text = text.replace(/\uE000(\d+)\uE001/g, (_, index: string) => kept[+index]);
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
}
