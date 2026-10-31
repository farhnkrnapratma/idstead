// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { renderMarkdown, resolveDefines } from '../packages/mdrs/core/src/markdown';
import {
    jsToDefineValue,
    validateDefineForSave,
    walkPath,
    type ApiRegistry
} from '../packages/mdrs/core/src/define';
import { usesLiveData } from '../packages/mdrs/core/src/liveData';

const analytics = jsToDefineValue({
    enabled: true,
    provider: 'umami',
    name: 'Umami',
    cookies: false,
    consent: false
});

const resolvers: ApiRegistry = { analytics: async path => walkPath(analytics, path) };

const render = (markdown: string) => renderMarkdown(markdown, resolvers);

async function value(expression: string, defines = '') {
    return resolveDefines(`:::define\n${defines}v: ${expression}\n:::\n\n\${v}`, resolvers);
}

describe('MDRS strings', () => {
    test('single quotes are literal and keep $ as written', async () => {
        expect(await value("'Hai $nama'", "nama: 'Ada'\n")).toBe('Hai $nama');
        expect(await value("'it\\'s a \"quote\"'")).toBe('it\'s a "quote"');
        expect(await value("'back\\\\slash \\n'")).toBe('back\\slash \\n');
    });

    test('double quotes expand $name and ${expr}', async () => {
        expect(await value('"Hai $nama"', "nama: 'Ada'\n")).toBe('Hai Ada');
        expect(await value('"${1 + 2} items"')).toBe('3 items');
        expect(await value('"via ${api.v1.analytics.name}"')).toBe('via Umami');
        expect(await value('"say \\"hi\\" to `you`"')).toBe('say "hi" to `you`');
    });

    test('a $ that starts no name or expression stays literal', async () => {
        expect(await value('"costs $5 or \\$total"')).toBe('costs $5 or $total');
    });

    test('nested quotes inside an expansion', async () => {
        expect(await value('"${true ? \'yes\' : "no"}"')).toBe('yes');
    });

    test('an unknown $name is an error', async () => {
        const html = await render(':::define\nv: "Hai $nobody"\nok: true\n:::\n\n${ok}');
        expect(
            (await validateDefineForSave(':::define\nv: "Hai $nobody"\n:::\n', resolvers)).ok
        ).toBe(false);
        expect(html).toContain('true');
    });
});

describe('MDRS ternary', () => {
    test('picks a branch from a boolean', async () => {
        expect(await value('api.v1.analytics.enabled ? "on" : "off"')).toBe('on');
        expect(await value('false ? 1 : true ? 2 : 3')).toBe('2');
    });

    test('rejects a non-boolean condition', async () => {
        const { ok, errors } = await validateDefineForSave(
            ':::define\nv: 1 ? 2 : 3\n:::\n',
            resolvers
        );
        expect(ok).toBe(false);
        expect(errors[0].message).toContain("'? :' requires a boolean condition");
    });
});

describe(':::if blocks', () => {
    const policy = [
        ':::if api.v1.analytics.enabled',
        ':::if api.v1.analytics.provider == "ga4"',
        'We use Google Analytics.',
        ":::elif api.v1.analytics.provider == 'umami'",
        'We use Umami, without cookies.',
        ':::endif',
        ':::else',
        'No analytics.',
        ':::endif'
    ].join('\n');

    test('keeps only the chosen branch, without a :::define block', async () => {
        const html = await render(policy);
        expect(html).toContain('We use Umami, without cookies.');
        expect(html).not.toContain('Google Analytics');
        expect(html).not.toContain('No analytics');
        expect(html).not.toContain(':::');
    });

    test('resolveDefines and the HTML agree', async () => {
        expect(await resolveDefines(policy, resolvers)).toBe('We use Umami, without cookies.');
    });

    test('falls through to nothing when no branch matches', async () => {
        expect(await resolveDefines(':::if false\nhidden\n:::endif\nshown', resolvers)).toBe(
            'shown'
        );
    });

    test('directives inside code stay literal', async () => {
        const source = '```mdrs\n:::if true\nx\n:::endif\n```';
        expect(await resolveDefines(source, resolvers)).toBe(source);
    });

    test('an unclosed block stays plain text from its opening line', async () => {
        const output = await resolveDefines('before\n:::if true\nafter', resolvers);
        expect(output).toBe('before\n:::if true\nafter');
    });

    test('a bad condition shows an error marker', async () => {
        const html = await render(':::if 1 + 1\ntext\n:::endif');
        expect(html).toContain('mdrs-define-error');
        expect(html).not.toContain('text');
    });

    test('validation reports structure and condition errors in every branch', async () => {
        const unclosed = await validateDefineForSave(':::if true\nx\n', resolvers);
        expect(unclosed.errors.map(error => error.message)).toContain(
            "':::if true' is never closed with :::endif"
        );
        const stray = await validateDefineForSave('x\n:::endif\n', resolvers);
        expect(stray.errors[0].message).toBe("':::endif' has no matching :::if");
        const branch = await validateDefineForSave(
            ':::if true\nok\n:::elif api.v1.nothing\nno\n:::endif',
            resolvers
        );
        expect(branch.ok).toBe(false);
    });

    test('conditions that read api.* make the document live', () => {
        expect(usesLiveData(':::if api.v1.analytics.enabled\nx\n:::endif')).toBe(true);
        expect(usesLiveData(':::if true\nx\n:::endif')).toBe(false);
    });
});

describe('inline ${if}', () => {
    const defines = ':::define\na: api.v1.analytics\n:::\n\n';

    test('chooses a branch inside a sentence, with Markdown and variables', async () => {
        expect(
            await resolveDefines(
                `${defines}Analytics: \${if a.enabled}**on** (\${a.name})\${else}off\${endif}.`,
                resolvers
            )
        ).toBe('Analytics: **on** (Umami).');
    });

    test('supports elif and nesting', async () => {
        const source = `${defines}\${if a.provider == "ga4"}GA\${elif a.provider == 'umami'}U\${if a.cookies}+c\${endif}\${else}-\${endif}`;
        expect(await resolveDefines(source, resolvers)).toBe('U');
    });

    test('stays literal without a :::define block', async () => {
        expect(await resolveDefines('${if true}x${endif}', resolvers)).toBe('${if true}x${endif}');
    });

    test('stray and unclosed tags are errors', async () => {
        const stray = await render(`${defines}x \${endif}`);
        expect(stray).toContain('mdrs-define-error');
        const unclosed = await validateDefineForSave(`${defines}\${if true}x`, resolvers);
        expect(unclosed.ok).toBe(false);
    });
});

describe('api.v1 resources', () => {
    test('an unknown resource lists the registered ones', async () => {
        const { errors } = await validateDefineForSave(
            ':::define\nv: api.v1.author\n:::\n',
            resolvers
        );
        expect(errors[0].message).toBe("Unknown api.v1 resource 'author' (supported: analytics)");
    });
});
