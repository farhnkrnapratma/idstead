// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

export interface TextEdit {
    value: string;
    selectionStart: number;
    selectionEnd: number;
}

export interface CursorPosition {
    line: number;
    column: number;
}

export function cursorPosition(value: string, offset: number): CursorPosition {
    const lines = value.substring(0, offset).split('\n');
    return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

export function wrapSelection(
    value: string,
    start: number,
    end: number,
    prefix: string,
    suffix = ''
): TextEdit {
    const selected = value.substring(start, end);
    return {
        value: value.substring(0, start) + prefix + selected + suffix + value.substring(end),
        selectionStart: start + prefix.length,
        selectionEnd: start + prefix.length + selected.length
    };
}

export function insertIndent(value: string, start: number, end: number, indent: string): TextEdit {
    const cursor = start + indent.length;
    return {
        value: value.substring(0, start) + indent + value.substring(end),
        selectionStart: cursor,
        selectionEnd: cursor
    };
}

const TASK_ITEM_RE = /^(\s*)([-*+]\s+\[[ xX]\])\s*(.*)$/;
const ORDERED_ITEM_RE = /^(\s*)(\d+)\.\s*(.*)$/;
const BULLET_ITEM_RE = /^(\s*)([-*+])\s*(.*)$/;
const QUOTE_LINE_RE = /^(\s*)(>+)\s*(.*)$/;

function continuation(line: string): string | null | undefined {
    const task = line.match(TASK_ITEM_RE);
    if (task) return task[3].trim() ? `\n${task[1]}- [ ] ` : null;
    const ordered = line.match(ORDERED_ITEM_RE);
    if (ordered)
        return ordered[3].trim() ? `\n${ordered[1]}${parseInt(ordered[2], 10) + 1}. ` : null;
    const bullet = line.match(BULLET_ITEM_RE);
    if (bullet) return bullet[3].trim() ? `\n${bullet[1]}${bullet[2]} ` : null;
    const quote = line.match(QUOTE_LINE_RE);
    if (quote) return quote[3].trim() ? `\n${quote[1]}${quote[2]} ` : null;
    return undefined;
}

export function continueBlock(value: string, start: number, end: number): TextEdit | null {
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const next = continuation(value.substring(lineStart, start));
    if (next === undefined) return null;
    if (next === null) {
        return {
            value: value.substring(0, lineStart) + value.substring(end),
            selectionStart: lineStart,
            selectionEnd: lineStart
        };
    }
    const cursor = start + next.length;
    return {
        value: value.substring(0, start) + next + value.substring(end),
        selectionStart: cursor,
        selectionEnd: cursor
    };
}

export function assetMarkdown(url: string, alt: string): string {
    const text = alt.replace(/[[\]"]/g, '');
    return `![${text}](${url} "${text}")`;
}
