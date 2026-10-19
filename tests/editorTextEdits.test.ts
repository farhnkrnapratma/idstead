import { describe, expect, test } from 'bun:test';
import {
    assetMarkdown,
    continueBlock,
    cursorPosition,
    insertIndent,
    wrapSelection
} from '../packages/lib/src/components/editor/textEdits.ts';

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

    test('assetMarkdown strips characters that would break the image syntax', () => {
        expect(assetMarkdown('/a.webp', 'My [cat] "pic"')).toBe(
            '![My cat pic](/a.webp "My cat pic")'
        );
    });
});

describe('editor highlighting', () => {
    test('keeps every dollar sign so the overlay lines up with the text', async () => {
        const { highlightMarkdown } =
            await import('../packages/lib/src/components/editor/highlight.ts');
        const source = 'Math $$x^2$$ and $$ a + b $$, a price of $5 and $$10.';
        const text = highlightMarkdown(source)
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
        expect(text).toBe(source);
    });
});
