// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export function tryEscapeComma(
    value: string,
    cursor: number
): { value: string; cursor: number } | null {
    if (cursor > 0 && value[cursor - 1] === '\\') {
        return { value: value.slice(0, cursor - 1) + ',' + value.slice(cursor), cursor };
    }
    return null;
}

export function splitEscapedCommas(text: string): string[] {
    const parts: string[] = [];
    let current = '';
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '\\' && text[i + 1] === ',') {
            current += ',';
            i++;
        } else if (text[i] === ',') {
            parts.push(current);
            current = '';
        } else {
            current += text[i];
        }
    }
    parts.push(current);
    return parts.map(s => s.trim()).filter(Boolean);
}
