// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

export function decodeHtmlEntities(str?: string | null): string {
    if (!str) return '';
    return str
        .replace(/&#x2F;/gi, '/')
        .replace(/&#47;/g, '/')
        .replace(/&#x27;/gi, "'")
        .replace(/&#39;/g, "'")
        .replace(/&apos;/gi, "'")
        .replace(/&quot;/gi, '"')
        .replace(/&#34;/g, '"')
        .replace(/&#x22;/gi, '"')
        .replace(/&lt;/gi, '<')
        .replace(/&#60;/g, '<')
        .replace(/&#x3C;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&#62;/g, '>')
        .replace(/&#x3E;/gi, '>')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&#160;/g, ' ')
        .replace(/&ndash;/gi, '-')
        .replace(/&#8211;/g, '-')
        .replace(/&mdash;/gi, '-')
        .replace(/&#8212;/g, '-')
        .replace(/&amp;/gi, '&')
        .replace(/&#38;/g, '&')
        .replace(/&#x26;/gi, '&');
}
