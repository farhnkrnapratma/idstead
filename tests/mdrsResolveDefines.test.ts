import { describe, expect, test } from 'bun:test';
import { resolveDefines } from '../packages/mdrs/core/src/markdown';
import { jsToDefineValue, walkPath, type ApiRegistry } from '../packages/mdrs/core/src/define';
import { markdownToPlainText } from '../packages/mdrs/core/src/plainText';

const author = jsToDefineValue({
    profile: { name: 'Ann Example', siteUrl: 'https://example.com' }
});
const resolvers: ApiRegistry = {
    author: async path => walkPath(author, path),
    blog: async path => walkPath(jsToDefineValue({}), path)
};

const legal = `:::define
name: api.v1.author.profile.name
site: api.v1.author.profile.siteUrl
:::

This policy covers **\${site}**, run by **\${name}**.`;

describe('resolveDefines', () => {
    test('fills the variables and drops the define block', async () => {
        expect(await resolveDefines(legal, resolvers)).toBe(
            'This policy covers **https://example.com**, run by **Ann Example**.'
        );
    });

    test('gives plain text without the define block or variable names', async () => {
        const text = markdownToPlainText(await resolveDefines(legal, resolvers));
        expect(text).toBe('This policy covers https://example.com, run by Ann Example.');
        expect(text).not.toContain('api.v1');
    });

    test('keeps code, escaped variables and ignore-render blocks literal', async () => {
        const source = [
            ':::define',
            'name: api.v1.author.profile.name',
            ':::',
            '',
            'Hi ${name}, write `${name}` or \\${name}.',
            '',
            '```js',
            'const x = `${name}`;',
            '```',
            '',
            ':::ignore-render',
            '${name}',
            ':::'
        ].join('\n');
        expect(await resolveDefines(source, resolvers)).toBe(
            [
                'Hi Ann Example, write `${name}` or \\${name}.',
                '',
                '```js',
                'const x = `${name}`;',
                '```',
                '',
                ':::ignore-render',
                '${name}',
                ':::'
            ].join('\n')
        );
    });

    test('keeps frontmatter and returns documents without a define block unchanged', async () => {
        const plain = '# Title\n\nCosts ${price}.';
        expect(await resolveDefines(plain, resolvers)).toBe(plain);
        expect(await resolveDefines(`---\ntitle: T\n---\n${legal}`, resolvers)).toBe(
            '---\ntitle: T\n---\nThis policy covers **https://example.com**, run by **Ann Example**.'
        );
    });
});
