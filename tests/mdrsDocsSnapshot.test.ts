import { beforeAll, describe, expect, test } from 'bun:test';
import path from 'node:path';

const docsRoot = path.resolve(import.meta.dir, '../docs/008-mdrs');
const demoFixture = path.resolve(import.meta.dir, 'fixtures/markdown-demo.md');

const markdownFiles = [...new Bun.Glob('**/*.md').scanSync(docsRoot)].sort();
const sources = await Promise.all(
    markdownFiles.map(file => Bun.file(path.join(docsRoot, file)).text())
);

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

const cases = markdownFiles.flatMap((file, fileIndex) =>
    mdrsExamples(sources[fileIndex]).map((markdown, index) => ({
        name: `${file} #${index + 1}`,
        markdown
    }))
);

let render: (markdown: string) => Promise<string>;

beforeAll(async () => {
    const markdown = await import('../packages/mdrs/core/src/markdown');
    render = source =>
        markdown.renderMarkdown(source, undefined, {
            internalOrigins: ['https://my-site.example']
        });
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
        expect(await render(await Bun.file(demoFixture).text())).toMatchSnapshot();
    });
});
