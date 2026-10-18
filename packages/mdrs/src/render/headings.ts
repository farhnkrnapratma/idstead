import { decodeHtmlEntities } from '../entities';
import { replaceKatexWithSource } from './math';

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

        const slug = replaceKatexWithSource(content)
            .replace(/<[^>]*>/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
        const baseId = `mdrs-${slug || `heading-${index++}`}`;

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

export function extractHeadings(html: string): HeadingItem[] {
    const headings: HeadingItem[] = [];
    const headingRegex = /<h([2-6])\b[^>]*\bid="([^"]*)"[^>]*>([\s\S]*?)<\/h\1>/gi;
    let match;
    while ((match = headingRegex.exec(html)) !== null) {
        const opening = match[0].slice(0, match[0].indexOf('>') + 1);
        if (/class="[^"]*\bmdrs-sr-only\b|\shidden(?:\s|>|=)|aria-hidden="true"/i.test(opening))
            continue;
        const level = parseInt(match[1], 10);
        const id = match[2];
        let content = replaceKatexWithSource(match[3])
            .replace(/<a\b[^>]*class="[^"]*mdrs-anchor[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '')
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

export function prefixHashLinks(html: string): string {
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]));
    return html.replace(
        /(<a\b[^>]*\shref=")#([^"]+)"/gi,
        (match, start: string, target: string) => {
            if (ids.has(target) || target.startsWith('mdrs-')) return match;
            return ids.has(`mdrs-${target}`) ? `${start}#mdrs-${target}"` : match;
        }
    );
}
