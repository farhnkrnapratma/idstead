// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { extractFrontmatter } from '../packages/mdrs/core/src/frontmatter';
import { renderMarkdown } from '../packages/mdrs/core/src/markdown';
import { unavailableResolvers, validateDefineForSave } from '../packages/mdrs/core/src/define';

const validate = (markdown: string) => validateDefineForSave(markdown, unavailableResolvers());

describe('frontmatter', () => {
    test('a leading YAML block is parsed and removed', () => {
        const { data, body, error } = extractFrontmatter(
            '---\ntitle: Hello\ntags: [a, b]\n---\n\n# Body'
        );
        expect(data).toEqual({ title: 'Hello', tags: ['a', 'b'] });
        expect(body).toBe('\n# Body');
        expect(error).toBeUndefined();
    });

    test('frontmatter never renders', async () => {
        const html = await renderMarkdown('---\ntitle: Hello\n---\n\nBody');
        expect(html).toBe('<p>Body</p>\n');
    });

    test('it must be on the first line', () => {
        expect(extractFrontmatter('\n---\ntitle: x\n---\n').data).toBeNull();
        expect(extractFrontmatter('Intro\n\n---\ntitle: x\n---\n').data).toBeNull();
    });

    test('a later --- pair stays a thematic break', async () => {
        const html = await renderMarkdown('---\ntitle: a\n---\n\nText\n\n---\n\nMore');
        expect(html).toContain('<hr>');
        expect(html).not.toContain('title: a');
    });

    test('invalid YAML falls back to plain markdown and is reported', async () => {
        const source = '---\ntitle: [unclosed\n---\n\nBody';
        const result = extractFrontmatter(source);
        expect(result.data).toBeNull();
        expect(result.body).toBe(source);
        expect(result.error).toMatch(/not valid YAML/);
        const { ok, errors } = await validate(source);
        expect(ok).toBe(false);
        expect(errors[0].message).toMatch(/Frontmatter is not valid YAML/);
    });

    test('a scalar is not a mapping', () => {
        expect(extractFrontmatter('---\njust text\n---\n').error).toMatch(/mapping/);
    });

    test(':::define may follow the frontmatter', async () => {
        const html = await renderMarkdown('---\ntitle: x\n---\n:::define\nn: 2\n:::\n\nn is ${n}');
        expect(html).toContain('n is 2');
    });
});

describe('save validation', () => {
    test('an empty :::define block is an error', async () => {
        const { ok, errors } = await validate(':::define\n:::\n\nbody');
        expect(ok).toBe(false);
        expect(errors.map(error => error.message)).toContain(
            'A :::define block needs at least one entry.'
        );
    });

    test('a document without :::define does not validate ${}', async () => {
        expect((await validate('Template ${missing}')).ok).toBe(true);
    });

    test('interpolation inside an inline conditional is checked', async () => {
        const { ok, errors } = await validate(
            ':::define\nok: true\n:::\n\n${if ok}Value ${nope}${endif}'
        );
        expect(ok).toBe(false);
        expect(errors[0].message).toBe("'nope' is undefined");
    });

    test('structural errors from :::references are reported', async () => {
        const { ok, errors } = await validate(':::references\n[^a]: x\n');
        expect(ok).toBe(false);
        expect(errors[0].message).toBe('Close the references block with :::.');
    });
});

describe('post import', () => {
    test('title, excerpt and tags come from the frontmatter', async () => {
        const { importPostDocument } = await import('../packages/mdrs/core/src/frontmatter');
        const post = importPostDocument(
            '---\ntitle: Hello\nexcerpt: Short\ntags: [mdrs, markdown]\ndraft: true\n---\n\n# Body'
        );
        expect(post).toEqual({
            title: 'Hello',
            excerpt: 'Short',
            tags: ['mdrs', 'markdown'],
            body: '# Body',
            ignored: ['draft']
        });
    });

    test('a comma separated tag string is accepted', async () => {
        const { importPostDocument } = await import('../packages/mdrs/core/src/frontmatter');
        expect(importPostDocument('---\ntags: a, b\n---\nx').tags).toEqual(['a', 'b']);
    });

    test('a file without frontmatter imports as body only', async () => {
        const { importPostDocument } = await import('../packages/mdrs/core/src/frontmatter');
        expect(importPostDocument('# Body')).toEqual({
            body: '# Body',
            ignored: [],
            error: undefined
        });
    });
});
