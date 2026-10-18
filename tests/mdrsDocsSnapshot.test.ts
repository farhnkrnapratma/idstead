import { beforeAll, describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const docsRoot = path.resolve(import.meta.dir, '../docs/002-mdrs');
const demoFixture = path.resolve(import.meta.dir, 'fixtures/markdown-demo.md');

function markdownFiles(dir: string): string[] {
    return readdirSync(dir)
        .sort()
        .flatMap(name => {
            const full = path.join(dir, name);
            if (statSync(full).isDirectory()) return markdownFiles(full);
            return name.endsWith('.md') ? [full] : [];
        });
}

function mdrsExamples(source: string): string[] {
    const examples: string[] = [];
    const lines = source.split('\n');
    let fence: string | null = null;
    let body: string[] = [];
    for (const line of lines) {
        if (fence === null) {
            const open = line.match(/^(`{3,}|~{3,})mdrs\s*$/);
            if (open) {
                fence = open[1];
                body = [];
            }
            continue;
        }
        const close = line.match(/^(`{3,}|~{3,})\s*$/);
        if (close && close[1][0] === fence[0] && close[1].length >= fence.length) {
            examples.push(body.join('\n'));
            fence = null;
            continue;
        }
        body.push(line);
    }
    return examples;
}

const cases = markdownFiles(docsRoot).flatMap(file =>
    mdrsExamples(readFileSync(file, 'utf8')).map((markdown, index) => ({
        name: `${path.relative(docsRoot, file)} #${index + 1}`,
        markdown
    }))
);

let render: (markdown: string) => Promise<string>;

beforeAll(async () => {
    const markdown = await import('../packages/lib/src/markdown');
    render = source => markdown.renderMarkdown(source);
});

describe('MDRS docs examples render unchanged', () => {
    test('the docs contain examples', () => {
        expect(cases.length).toBeGreaterThan(50);
    });

    for (const { name, markdown } of cases) {
        test(name, async () => {
            expect(await render(markdown)).toMatchSnapshot();
        });
    }

    test('markdown-demo fixture', async () => {
        expect(await render(readFileSync(demoFixture, 'utf8'))).toMatchSnapshot();
    });
});
