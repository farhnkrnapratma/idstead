// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

export function parseSteps(html: string): string {
    if (!html) return '';

    const marker = '<div class="mdrs-steps"';
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
                                                /<span class="mdrs-list-marker"[^>]*><\/span>/gi,
                                                ''
                                            )
                                            .trim();
                                        return `<li${cleanLiAttrs} class="mdrs-step">${cleanContent}</li>`;
                                    }
                                );
                                return `<ol${cleanAttrs} class="mdrs-steps-list">${transformedLi}</ol>`;
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
                                .map(part => `<div class="mdrs-step">${part.trim()}</div>`)
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
