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

export function offsetAt(value: string, { line, column }: CursorPosition): number {
    const lines = value.split('\n');
    let offset = 0;
    for (let i = 0; i < Math.min(line, lines.length) - 1; i++) offset += lines[i].length + 1;
    return Math.min(offset + column - 1, value.length);
}

function markerRun(value: string, at: number, step: 1 | -1, char: string): number {
    let length = 0;
    while (value[at + length * step] === char) length++;
    return length;
}

function wrappedBy(value: string, start: number, end: number, prefix: string, suffix: string) {
    if (!value.substring(0, start).endsWith(prefix) || !value.substring(end).startsWith(suffix))
        return false;
    const char = prefix[0];
    if (prefix !== char.repeat(prefix.length) || suffix !== prefix) return true;
    return (
        markerRun(value, start - 1, -1, char) === prefix.length &&
        markerRun(value, end, 1, char) === suffix.length
    );
}

export function wrapSelection(
    value: string,
    start: number,
    end: number,
    prefix: string,
    suffix = ''
): TextEdit {
    const selected = value.substring(start, end);
    if (suffix && wrappedBy(value, start, end, prefix, suffix))
        return {
            value:
                value.substring(0, start - prefix.length) +
                selected +
                value.substring(end + suffix.length),
            selectionStart: start - prefix.length,
            selectionEnd: end - prefix.length
        };
    if (
        suffix &&
        selected.length >= prefix.length + suffix.length &&
        wrappedBy(selected, prefix.length, selected.length - suffix.length, prefix, suffix)
    ) {
        const inner = selected.slice(prefix.length, selected.length - suffix.length);
        return {
            value: value.substring(0, start) + inner + value.substring(end),
            selectionStart: start,
            selectionEnd: start + inner.length
        };
    }
    return {
        value: value.substring(0, start) + prefix + selected + suffix + value.substring(end),
        selectionStart: start + prefix.length,
        selectionEnd: start + prefix.length + selected.length
    };
}

const LINE_PREFIX_FAMILIES = [/^#{1,6} /, /^(?:[-*+] \[[ xX]\] |[-*+] |\d+[.)] )/, /^> /];

export function toggleLinePrefix(
    value: string,
    start: number,
    end: number,
    prefix: string
): TextEdit {
    const family = LINE_PREFIX_FAMILIES.find(pattern => pattern.test(prefix)) ?? /^$/;
    const numbered = /^\d+[.)] $/.test(prefix);
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lastChar = end > start && value[end - 1] === '\n' ? end - 1 : end;
    const nextBreak = value.indexOf('\n', lastChar);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    const lines = value
        .substring(lineStart, lineEnd)
        .split('\n')
        .map(line => {
            const indent = /^[ \t]*/.exec(line)?.[0] ?? '';
            const body = line.slice(indent.length);
            const existing = family.exec(body)?.[0] ?? '';
            return { indent, existing, rest: body.slice(existing.length) };
        });
    const content = lines.filter(line => line.existing || line.rest);
    const targets = content.length ? content : lines;
    const remove = targets.every(line =>
        numbered ? /^\d+[.)] $/.test(line.existing) : line.existing === prefix
    );
    let number = 0;
    const next = lines.map(line => {
        if (!targets.includes(line)) return line.indent + line.rest;
        const marker = remove ? '' : numbered ? `${++number}. ` : prefix;
        return line.indent + marker + line.rest;
    });
    const block = next.join('\n');
    const edited = value.substring(0, lineStart) + block + value.substring(lineEnd);
    if (lines.length > 1)
        return { value: edited, selectionStart: lineStart, selectionEnd: lineStart + block.length };
    const shift = next[0].length - (lines[0].indent + lines[0].existing + lines[0].rest).length;
    const floor =
        lineStart +
        lines[0].indent.length +
        (next[0].length - lines[0].indent.length - lines[0].rest.length);
    return {
        value: edited,
        selectionStart: Math.max(start + shift, floor),
        selectionEnd: Math.max(end + shift, floor)
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

function blankLineGap(text: string, atEnd: boolean): string {
    if (!text) return '';
    const edge = atEnd ? text.slice(-2) : text.slice(0, 2);
    if (edge === '\n\n') return '';
    return (atEnd ? edge.endsWith('\n') : edge.startsWith('\n')) ? '\n' : '\n\n';
}

export function placeBlock(
    value: string,
    start: number,
    end: number,
    opening: string,
    closing = ''
): TextEdit {
    if (closing) {
        const wrapped = wrapSelection(value, start, end, opening, closing);
        if (wrapped.value.length < value.length) return wrapped;
        const lead = start > 0 && value[start - 1] !== '\n' ? '\n' : '';
        const trail = end < value.length && value[end] !== '\n' ? '\n' : '';
        return wrapSelection(value, start, end, lead + opening, closing + trail);
    }
    const before = value.substring(0, end);
    const after = value.substring(end);
    const lead = blankLineGap(before, true);
    const trail = after ? blankLineGap(after, false) : '\n';
    const cursor = before.length + lead.length + opening.length;
    return {
        value: before + lead + opening + trail + after,
        selectionStart: cursor,
        selectionEnd: cursor
    };
}

const FRONTMATTER = /^---\n[\s\S]*?\n---(?:\n|$)/;
const DEFINE_TEMPLATE = ':::define\nname: "value"\n:::\n';

export function placeDefine(value: string): TextEdit {
    const frontmatter = FRONTMATTER.exec(value)?.[0] ?? '';
    const rest = value.slice(frontmatter.length);
    const blank = /^\s*/.exec(rest)?.[0] ?? '';
    if (rest.startsWith(':::define', blank.length)) {
        const open = frontmatter.length + blank.length;
        const close = value.indexOf('\n:::', open + ':::define'.length);
        const cursor = close === -1 ? value.length : close;
        return { value, selectionStart: cursor, selectionEnd: cursor };
    }
    const name = frontmatter.length + ':::define\n'.length;
    return {
        value: frontmatter + DEFINE_TEMPLATE + (rest ? '\n' : '') + rest,
        selectionStart: name,
        selectionEnd: name + 'name'.length
    };
}

export function verbatimFence(text: string): string {
    const longest = Math.max(
        0,
        ...[...text.matchAll(/^ {0,3}(:+)/gm)].map(match => match[1].length)
    );
    return ':'.repeat(Math.max(3, longest + 1));
}
