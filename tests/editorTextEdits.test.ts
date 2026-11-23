// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    assetMarkdown,
    continueBlock,
    cursorPosition,
    insertIndent,
    offsetAt,
    wrapSelection
} from '../packages/mdrs/editor/src/textEdits.ts';
import { editorProblems, problemLines } from '../packages/mdrs/editor/src/problems.ts';

describe('editor text edits', () => {
    test('wrapSelection wraps the selection and keeps it selected', () => {
        expect(wrapSelection('say hi now', 4, 6, '**', '**')).toEqual({
            value: 'say **hi** now',
            selectionStart: 6,
            selectionEnd: 8
        });
    });

    test('insertIndent replaces the selection with the indent', () => {
        expect(insertIndent('ab', 1, 1, '    ')).toEqual({
            value: 'a    b',
            selectionStart: 5,
            selectionEnd: 5
        });
    });

    test('continueBlock continues bullets, numbers, tasks and quotes', () => {
        expect(continueBlock('- one', 5, 5)?.value).toBe('- one\n- ');
        expect(continueBlock('  9. nine', 9, 9)?.value).toBe('  9. nine\n  10. ');
        expect(continueBlock('- [x] done', 10, 10)?.value).toBe('- [x] done\n- [ ] ');
        expect(continueBlock('>> quoted', 9, 9)?.value).toBe('>> quoted\n>> ');
    });

    test('continueBlock clears an empty marker instead of continuing', () => {
        expect(continueBlock('- one\n- ', 8, 8)).toEqual({
            value: '- one\n',
            selectionStart: 6,
            selectionEnd: 6
        });
    });

    test('continueBlock leaves plain lines to the browser', () => {
        expect(continueBlock('plain text', 10, 10)).toBeNull();
    });

    test('cursorPosition reports 1-based line and column', () => {
        expect(cursorPosition('ab\ncde', 5)).toEqual({ line: 2, column: 3 });
    });

    test('offsetAt reverses cursorPosition and clamps to the text', () => {
        expect(offsetAt('ab\ncde', { line: 2, column: 3 })).toBe(5);
        expect(offsetAt('ab\r\ncde', { line: 2, column: 1 })).toBe(4);
        expect(offsetAt('ab', { line: 9, column: 9 })).toBe(2);
    });

    test('editorProblems reports MDRS diagnostics with 1-based positions', () => {
        const problems = editorProblems(':::callout\nBody\n:::\n:::');
        expect(problems).toEqual([
            { line: 1, column: 1, message: ':::callout requires title="..."', severity: 'error' },
            {
                line: 4,
                column: 1,
                message: '`:::` has no open block to close. It renders as plain text.',
                severity: 'warning'
            }
        ]);
        expect(problemLines([...problems, { ...problems[1], line: 1 }])).toEqual(
            new Map([
                [1, 'error'],
                [4, 'warning']
            ])
        );
    });

    test('assetMarkdown strips characters that would break the image syntax', () => {
        expect(assetMarkdown('/a.webp', 'My [cat] "pic"')).toBe(
            '![My cat pic](/a.webp "My cat pic")'
        );
    });
});

describe('editor highlighting', () => {
    test('keeps every dollar sign so the overlay lines up with the text', async () => {
        const { highlightMarkdown } = await import('../packages/mdrs/editor/src/highlight.ts');
        const source = 'Math $$x^2$$ and $$ a + b $$, a price of $5 and $$10.';
        const text = highlightMarkdown(source)
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
        expect(text).toBe(source);
    });
});
