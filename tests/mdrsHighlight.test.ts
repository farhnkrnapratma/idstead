// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import hljs from 'highlight.js';
import { mdrsLanguage } from '../packages/mdrs/dom/src/mdrsHighlight.ts';

hljs.registerLanguage('mdrs', mdrsLanguage);

const highlight = (source: string) => hljs.highlight(source, { language: 'mdrs' }).value;
const span = (scope: string, text: string) => `<span class="hljs-${scope}">${text}</span>`;

describe('MDRS highlight.js language', () => {
    test('marks directives, their attributes and closing lines', () => {
        const html = highlight(':::callout title="Changelog" icon="rocket"\nBody\n:::\n');
        expect(html).toContain(span('keyword', ':::callout'));
        expect(html).toContain(span('attr', 'title'));
        expect(html).toContain(span('string', '&quot;Changelog&quot;'));
        expect(html).toContain(span('keyword', ':::'));
        expect(highlight('::tab label="A"\n::\n')).toContain(span('keyword', '::tab'));
    });

    test('marks define keys, values, get() and comments', () => {
        const html = highlight(
            ":::define\nprice: 120000, discount: 0.15 // note\ncity: get('https://a.example/v1', '.city')\nok: true\n:::\n"
        );
        expect(html).toContain(span('keyword', ':::define'));
        expect(html).toContain(span('attr', 'price'));
        expect(html).toContain(span('attr', 'discount'));
        expect(html).toContain(span('number', '120000'));
        expect(html).toContain(span('comment', '// note'));
        expect(html).toContain(span('built_in', 'get'));
        expect(html).toContain(span('literal', 'true'));
    });

    test('interpolates inside double-quoted strings only', () => {
        const html = highlight(':::define\na: "Hi $name ${1}"\nb: \'Hi $name\'\n:::\n');
        expect(html).toContain(span('template-variable', '$name'));
        expect(html).toContain(span('string', '&#x27;Hi $name&#x27;'));
    });

    test('marks conditionals in blocks and inline', () => {
        const block = highlight(':::if a >= 3\nx\n:::elif b\ny\n:::else\nz\n:::endif\n');
        expect(block).toContain(span('keyword', ':::if'));
        expect(block).toContain(span('operator', '&gt;='));
        expect(block).toContain(span('keyword', ':::else'));
        expect(block).toContain(span('keyword', ':::endif'));
        const inline = highlight('Is ${if on}yes${else}no${endif}.');
        expect(inline).toContain(span('keyword', 'if'));
        expect(inline).toContain(span('keyword', 'endif'));
    });

    test('marks interpolation inside headings and bold text, but not escaped', () => {
        expect(highlight('# Hi ${name}')).toContain(span('template-variable', '${name}'));
        expect(highlight('**${name}**')).toContain(span('template-variable', '${name}'));
        expect(highlight('Write \\${name}')).not.toContain('hljs-template-variable');
    });

    test('marks inline and block math', () => {
        expect(highlight('A $$ x^2 $$ b')).toContain(span('formula', '$$ x^2 $$'));
        const block = highlight(':::math\n\\frac{1}{2}\n:::\n');
        expect(block).toContain(span('keyword', ':::math'));
        expect(block).toContain('language-latex');
    });

    test('marks frontmatter only at the start of the document', () => {
        expect(highlight('---\ntitle: A\n---\nBody')).toContain('language-yaml');
        expect(highlight('Intro\n\n---\ntitle: A\n---\n')).not.toContain('language-yaml');
    });

    test('marks task states after list bullets', () => {
        const html = highlight('- [x] done\n- [?] ask\n');
        expect(html).toContain(span('symbol', '[x]'));
        expect(html).toContain(span('symbol', '[?]'));
    });

    test('leaves verbatim blocks and code fences unhighlighted', () => {
        const verbatim = highlight('::::verbatim\n:::note\n${raw}\n:::\n::::\n');
        expect(verbatim).toContain(span('keyword', '::::verbatim'));
        expect(verbatim).toContain(span('keyword', '::::'));
        expect(verbatim).not.toContain(span('keyword', ':::note'));
        expect(verbatim).not.toContain('hljs-template-variable');
        expect(highlight('```ts\n:::note\n```\n')).not.toContain(span('keyword', ':::note'));
    });
});
