import { beforeAll, describe, expect, test } from 'bun:test';

let render: (markdown: string) => Promise<string>;
let getDownloadFilename: (className: string, filename?: string) => string;

beforeAll(async () => {
    const markdown = await import('../src/lib/markdown');
    render = markdownSource => markdown.renderMarkdown(markdownSource);
    getDownloadFilename = (await import('../src/lib/utils/codeBlockExtensions'))
        .getDownloadFilename;
});

describe('links, images and videos', () => {
    test('link keeps title as an escaped attribute', async () => {
        const html = await render('[Google](https://google.com "Google")');
        expect(html).toContain('href="https://google.com"');
        expect(html).toContain('title="Google"');
        expect(html).toContain('target="_blank"');
    });

    test('link title and href cannot break out of the attribute', async () => {
        const html = await render(
            '[a](https://x.test "t&quot; onmouseover=alert(1) x")\n\n[b](<https://x.test/"onmouseover=alert(1)>)'
        );
        expect(html).not.toMatch(/"\s+onmouseover=/);
    });

    test('unsafe link schemes are neutralised', async () => {
        const html = await render(
            '[a](javascript:alert(1)) [b](JAVASCRIPT:alert(1)) [c](data:text/html,x) [d](<Java\tScript:alert(1)>)'
        );
        expect(html).not.toMatch(/href="[^"]*script:/i);
        expect(html).not.toMatch(/href="data:/i);
        expect(html.match(/href="#"/g)?.length).toBe(4);
    });

    test('image renders with alt and title', async () => {
        const html = await render('![Alt text](/logo.png "title")');
        expect(html).toContain('<img src="/logo.png" alt="Alt text" title="title" loading="lazy"');
    });

    test('video extensions render a video element', async () => {
        const mp4 = await render('![Demo](/blog/content/abc.mp4 "Clip")');
        expect(mp4).toContain('<video controls');
        expect(mp4).toContain('src="/blog/content/abc.mp4"');
        expect(mp4).toContain('title="Clip"');
        expect(mp4).toContain('aria-label="Demo"');
        const webm = await render('![Demo](https://cdn.test/a.webm?x=1)');
        expect(webm).toContain('<video controls');
    });

    test('image with unsafe source falls back to alt text', async () => {
        const html = await render('![x"y](javascript:alert(1))');
        expect(html).not.toContain('<img');
        expect(html).not.toContain('javascript:');
    });
});

describe('standard markdown', () => {
    test('blockquote, backslash break and thematic break', async () => {
        const html = await render(
            '> A greater than\n\nA backslash\\\nbefore a line break\n\nThree asterisks:\n\n***'
        );
        expect(html).toContain('<blockquote>');
        expect(html).toContain('A backslash<br>');
        expect(html).toContain('<hr>');
    });

    test('github alert syntax is a plain blockquote now', async () => {
        const html = await render('> [!NOTE]\n> hello');
        expect(html).toContain('<blockquote>');
        expect(html).not.toContain('markdown-alert');
    });
});

describe('code fences', () => {
    test('filename and mark are exposed on the pre element', async () => {
        const html = await render(
            '```python filename="main.py" mark=1,3,5..6\na\nb\nc\nd\ne\nf\ng\n```'
        );
        expect(html).toContain('data-highlight-lines="1,3,5,6"');
        expect(html).toContain('data-filename="main.py"');
        expect(html).toContain('class="language-python"');
    });

    test('filename and mark are both optional', async () => {
        const plain = await render('```ts\nx\n```');
        expect(plain).not.toContain('data-filename');
        expect(plain).not.toContain('data-highlight-lines');
        const onlyName = await render('```ts filename="a.ts"\nx\n```');
        expect(onlyName).toContain('data-filename="a.ts"');
        const onlyMark = await render('```ts mark=1\nx\n```');
        expect(onlyMark).toContain('data-highlight-lines="1"');
    });

    test('mark ranges are clamped and invalid parts are ignored', async () => {
        const html = await render('```ts mark=2..99,x,5-6,0\na\nb\nc\n```');
        expect(html).toContain('data-highlight-lines="2,3"');
    });

    test('old brace syntax no longer marks lines', async () => {
        const html = await render('```ts {1}\na\n```');
        expect(html).not.toContain('data-highlight-lines');
    });

    test('filename is escaped', async () => {
        const html = await render('```ts filename="a&b.ts"\nx\n```');
        expect(html).toContain('data-filename="a&amp;b.ts"');
    });

    test('mark text inside the filename is not treated as a range', async () => {
        const html = await render('```ts filename="x mark=1.ts"\na\nb\n```');
        expect(html).not.toContain('data-highlight-lines');
    });

    test('download filename prefers the sanitised custom filename', () => {
        expect(getDownloadFilename('language-python', 'main.py')).toBe('main.py');
        expect(getDownloadFilename('language-python', '../../etc/passwd')).toBe('passwd');
        expect(getDownloadFilename('language-python', 'a\\b\\c.txt')).toBe('c.txt');
        expect(getDownloadFilename('language-python', '..')).toBe('snippet.py');
        expect(getDownloadFilename('language-tsx')).toBe('snippet.tsx');
        expect(getDownloadFilename('language-docker')).toBe('Dockerfile');
        expect(getDownloadFilename('language-python', '  ')).toBe('snippet.py');
    });
});

describe('callouts', () => {
    test.each(['note', 'tip', 'important', 'warning', 'caution'])(
        ':::%s renders an alert',
        async type => {
            const html = await render(`:::${type}\nhello **world**\n:::`);
            expect(html).toContain(`markdown-alert markdown-alert-${type}`);
            expect(html).toContain('<strong>world</strong>');
            expect(html).not.toContain(':::');
        }
    );

    test('custom callout with title and icon', async () => {
        const html = await render(':::callout title="Pro <Tip>" icon="rocket"\nbody\n:::');
        expect(html).toContain('markdown-callout');
        expect(html).toContain('<span>Pro &lt;Tip&gt;</span>');
        expect(html).toContain('lucide-rocket');
    });

    test('icon is optional and unknown icons render nothing', async () => {
        const without = await render(':::callout title="T"\nbody\n:::');
        expect(without).toContain('<span>T</span>');
        const unknown = await render(':::callout title="T" icon="nope"\nbody\n:::');
        expect(unknown).not.toContain('<i class');
        expect(unknown).not.toContain('<svg');
    });

    test('bootstrap icons are accepted', async () => {
        const html = await render(':::callout title="T" icon="bi-facebook"\nbody\n:::');
        expect(html).toContain('bi bi-facebook');
    });

    test('callout without a title is reported', async () => {
        const html = await render(':::callout icon="rocket"\nbody\n:::');
        expect(html).toContain('markdown-define-error');
        expect(html).not.toContain('markdown-callout"');
    });

    test('old brace attribute syntax is not accepted', async () => {
        const html = await render(':::callout{title="T"}\nbody\n:::');
        expect(html).not.toContain('markdown-callout');
    });
});

describe('math', () => {
    test('$$ ... $$ is inline math', async () => {
        const html = await render('Euler: $$ e^{i\\pi} + 1 = 0 $$ done');
        expect(html).toContain('class="katex"');
        expect(html).not.toContain('katex-display');
        expect(html).not.toContain('$$');
    });

    test(':::math is a display block', async () => {
        const html = await render(':::math\n\\int_0^1 x\\,dx\n:::');
        expect(html).toContain('katex-block');
        expect(html).toContain('katex-display');
    });

    test('single dollars and old delimiters are plain text', async () => {
        const html = await render('It costs $5 and $10, or \\(x\\) or $x$.');
        expect(html).not.toContain('katex');
        expect(html).toContain('$5 and $10');
    });

    test('math inside code is untouched', async () => {
        const html = await render('`$$ x $$`\n\n```\n:::math\nx\n:::\n```');
        expect(html).not.toContain('katex');
    });

    test('math works inside other containers', async () => {
        const html = await render(':::note\nvalue $$ x^2 $$\n:::');
        expect(html).toContain('markdown-alert-note');
        expect(html).toContain('class="katex"');
    });
});

describe('tabs and snippets', () => {
    const tabs = (name: string, attrs = '') =>
        `:::${name}${attrs}\n::tab label="A" icon="zap"\nfirst\n::\n::tab label="B <b>"\nsecond\n::\n:::`;

    test(':::tabs renders content tabs without a sync key', async () => {
        const html = await render(tabs('tabs', ' key="x"'));
        expect(html).toContain('markdown-tab-group');
        expect(html).not.toContain('markdown-tabs-container');
        expect(html).not.toContain('data-tab-group-key');
        expect(html).toContain('data-tab-label="A"');
        expect(html).toContain('lucide-zap');
        expect(html).toContain('data-tab-label="B &lt;b&gt;"');
        expect(html).toContain('<p>first</p>');
    });

    test(':::snippets renders code tabs with an optional key', async () => {
        const keyed = await render(tabs('snippets', ' key="pm"'));
        expect(keyed).toContain('markdown-tabs-container');
        expect(keyed).toContain('data-tab-group-key="pm"');
        const plain = await render(tabs('snippets'));
        expect(plain).not.toContain('data-tab-group-key');
    });

    test('old tab-group and brace attributes are not accepted', async () => {
        expect(await render(':::tab-group{key="a"}\n::tab{label="A"}\nx\n::\n:::')).not.toContain(
            'markdown-tab'
        );
    });

    test('a tab without a label is reported', async () => {
        const html = await render(':::tabs\n::tab\nx\n::\n:::');
        expect(html).toContain('markdown-define-error');
        expect(html).not.toContain('data-tab-label');
    });

    test('code blocks and nested containers work inside tabs', async () => {
        const html = await render(
            [
                ':::snippets key="pm"',
                '::tab label="bun" icon="terminal"',
                '```bash',
                'bun add x',
                '```',
                '::',
                '::tab label="steps"',
                ':::steps',
                '1. one',
                '2. two',
                ':::',
                ':::note',
                'careful',
                ':::',
                '::',
                ':::'
            ].join('\n')
        );
        expect(html).toContain('language-bash');
        expect(html).toContain('markdown-steps-list');
        expect(html).toContain('markdown-alert-note');
        expect(html.match(/role="tabpanel"/g)?.length).toBe(2);
        expect(html).not.toContain(':::');
    });

    test('a missing :: before ::: still closes the tab', async () => {
        const html = await render(':::tabs\n::tab label="A"\nx\n:::\n\nafter');
        expect(html).toContain('data-tab-label="A"');
        expect(html).toContain('<p>after</p>');
    });
});

describe('details', () => {
    test(':::details renders a collapsible card', async () => {
        const html = await render(':::details summary="More <info>"\n- a\n- b\n:::');
        expect(html).toContain('markdown-details');
        expect(html).toContain('More &lt;info&gt;');
        expect(html).toContain('ul-list-item');
    });

    test('details can nest', async () => {
        const html = await render(
            ':::details summary="Outer"\n:::details summary="Inner"\ndeep\n:::\n:::'
        );
        expect(html.match(/<details/g)?.length).toBe(2);
        expect(html).toContain('deep');
        expect(html).not.toContain(':::');
    });

    test('summary is required', async () => {
        const html = await render(':::details\nbody\n:::');
        expect(html).toContain('markdown-define-error');
    });
});

describe('embed', () => {
    test('youtube and codepen render an iframe', async () => {
        const youtube = await render(':::embed url="https://youtu.be/Ec08db2hP10?si=abc"');
        expect(youtube).toContain('https://www.youtube.com/embed/Ec08db2hP10');
        const codepen = await render(':::embed url="https://codepen.io/user/pen/abc123"');
        expect(codepen).toContain('https://codepen.io/user/embed/abc123');
    });

    test('unknown providers become an escaped link', async () => {
        const html = await render(':::embed url="https://example.com/a?b=1&c=2"');
        expect(html).toContain('<a href="https://example.com/a?b=1&amp;c=2"');
        expect(html).not.toContain('<iframe');
    });

    test('dangerous urls never become links', async () => {
        const html = await render(':::embed url="javascript:alert(1)"');
        expect(html).not.toContain('href=');
        expect(html).not.toContain('<iframe');
    });

    test('url is required and old brace syntax is rejected', async () => {
        expect(await render(':::embed')).toContain('markdown-define-error');
        expect(await render(':::embed{url="https://youtu.be/abc"}')).not.toContain('<iframe');
    });
});

describe('robustness and removed directives', () => {
    test('unclosed containers stay literal instead of throwing', async () => {
        const html = await render(':::note\nnever closed');
        expect(html).toContain(':::note');
        expect(html).toContain('never closed');
    });

    test('a stray closer stays literal', async () => {
        const html = await render('before\n\n:::\n\nafter');
        expect(html).toContain(':::');
    });

    test('a leading :::config block is no longer stripped', async () => {
        const html = await render(':::config\ntheme: old\n:::\n\nbody');
        expect(html).toContain(':::config');
    });

    test('directives inside code fences are left alone', async () => {
        const html = await render('```md\n:::note\nx\n:::\n```');
        expect(html).not.toContain('markdown-alert');
        expect(html).toContain(':::note');
    });

    test('raw html summary text from attributes cannot inject markup', async () => {
        const html = await render(':::callout title="</span><img src=x onerror=alert(1)>"\nx\n:::');
        expect(html).not.toContain('<img');
    });
});

describe('icon resolution', () => {
    let resolve: (value: string) => Promise<string>;

    beforeAll(async () => {
        resolve = (await import('../src/lib/markdownIcons')).resolveIconMarkup;
    });

    test('lucide wins when the name exists in both libraries', async () => {
        expect(await resolve('list')).toContain('lucide lucide-list ');
        expect(await resolve('rocket')).toContain('<path');
    });

    test('falls back to bootstrap when lucide has no such icon', async () => {
        expect(await resolve('facebook')).toBe(
            '<i class="bi bi-facebook shrink-0" aria-hidden="true"></i>'
        );
    });

    test('prefixes force the library', async () => {
        expect(await resolve('lucide-rocket')).toContain('lucide-rocket');
        expect(await resolve('bi-facebook')).toContain('bi bi-facebook');
        expect(await resolve('bi-rocket')).toContain('bi bi-rocket');
        expect(await resolve('lucide-facebook')).toBe('');
    });

    test('unknown or malformed names render nothing', async () => {
        expect(await resolve('definitely-not-an-icon')).toBe('');
        expect(await resolve('../../etc/passwd')).toBe('');
        expect(await resolve('')).toBe('');
    });
});

describe('hardening', () => {
    test('entity-encoded schemes cannot smuggle javascript urls', async () => {
        const html = await render(
            '[a](javascript&colon;alert(1)) [b](&#106;avascript:alert(1)) [c](java&#x09;script:alert(1))'
        );
        expect(html).not.toMatch(/href="(?:javascript:|&#|java&#)/i);
        expect(html).toContain('href="javascript&amp;colon;');
    });

    test('urls keep working with query strings', async () => {
        const html = await render('[a](https://x.test/?a=1&b=2)');
        expect(html).toContain('href="https://x.test/?a=1&amp;b=2"');
    });

    test('self-referencing placeholder text cannot blow up output', async () => {
        const hostile = Array(8).fill('@@IGNORE_RENDER_0@@').join(' ');
        const html = await render(`:::ignore-render\n${hostile}\n:::`);
        expect(html.length).toBeLessThan(100_000);
        const inline = await render(Array(8).fill('`@@INLINE_CODE_0@@`').join(' '));
        expect(inline.length).toBeLessThan(100_000);
    });

    test('a long directive line does not backtrack', async () => {
        const started = performance.now();
        await render(`:::a${' '.repeat(6000)}\u2028\nbody\n:::`);
        expect(performance.now() - started).toBeLessThan(1000);
    });

    test('replacement patterns in filenames stay literal', async () => {
        const html = await render('```js filename="a$&b$\'d.js"\nx\n```');
        expect(html).toContain('data-filename="a$&amp;b$&#39;d.js"');
        expect(html.match(/<pre/g)?.length).toBe(1);
    });

    test('oversized documents are refused', async () => {
        await expect(render('x'.repeat(600_000))).rejects.toThrow('too large');
    });

    test('bidi override characters are stripped from download names', () => {
        expect(getDownloadFilename('language-js', 'x‮txt.exe')).toBe('xtxt.exe');
    });
});

describe('audit regressions', () => {
    test('inline code inside attributes cannot break out', async () => {
        const tab = await render(
            ':::tabs\n::tab label="`\\" onmouseover=\\"alert(1)`"\na\n::\n:::'
        );
        expect(tab).not.toMatch(/"\s+onmouseover=/);
        const callout = await render(
            ':::callout title="`<img src=x onerror=alert(1)>`"\nbody\n:::'
        );
        expect(callout).not.toContain('<img');
    });

    test('math inside attributes is dropped instead of injected', async () => {
        const html = await render(':::tabs\n::tab label="$$x$$"\na\n::\n:::');
        expect(html).not.toContain('katex');
        expect(html).not.toContain('@@');
    });

    test(':::define variables work inside math', async () => {
        const inline = await render(':::define\nn: 5\n:::\n\n$$ x = ${n} $$');
        expect(inline).not.toContain('@@INTERPOLATION');
        expect(inline).toContain('x = 5');
        const block = await render(':::define\nn: 5\n:::\n\n:::math\nx = ${n}\n:::');
        expect(block).not.toContain('@@INTERPOLATION');
    });

    test('inline code inside math is restored, not leaked', async () => {
        const html = await render('$$ `a` $$');
        expect(html).not.toContain('@@');
    });

    test('empty and uppercase tab directives', async () => {
        const empty = await render(':::tabs\n:::');
        expect(empty).toContain('markdown-define-error');
        expect(empty).not.toContain('<pre>');
        const upper = await render(':::TABS\n::TAB label="A"\nx\n::\n:::');
        expect(upper).toContain('data-tab-label="A"');
    });

    test('four-space indented directives are code, not directives', async () => {
        const html = await render('    :::note\n    x\n    :::');
        expect(html).not.toContain('markdown-alert');
    });

    test('indented code at the start of a container is preserved', async () => {
        const html = await render(':::note\n\n    code\n:::');
        expect(html).toContain('<pre>');
    });

    test('attribute values accept escaped quotes', async () => {
        const html = await render(':::details summary="a \\"b\\" c"\nx\n:::');
        expect(html).toContain('a &quot;b&quot; c');
    });

    test('embed providers must be the host, not a query string', async () => {
        const html = await render(':::embed url="https://evil.test/?u=youtu.be/abc"');
        expect(html).not.toContain('<iframe');
    });

    test('video detection ignores extensions in the query string', async () => {
        const html = await render('![x](/a.png?f=.mp4)');
        expect(html).toContain('<img');
        expect(html).not.toContain('<video');
    });

    test('icon attribute names are case-insensitive', async () => {
        const html = await render(':::callout title="T" ICON="rocket"\nx\n:::');
        expect(html).toContain('lucide-rocket');
    });
});

describe('plain text export', () => {
    let toText: (markdown: string) => string;

    beforeAll(async () => {
        toText = (await import('../src/lib/utils/markdownToText')).markdownToPlainText;
    });

    test('fences with the new info string keep their body intact', () => {
        const text = toText('```ts filename="a_b.ts" mark=1\nconst a_b = 1\n```');
        expect(text).toBe('const a_b = 1');
    });

    test('directive markers are stripped but titles and labels stay', () => {
        const text = toText(
            ':::callout title="Heads up" icon="zap"\nbody\n:::\n\n:::tabs\n::tab label="One"\nfirst\n::\n:::'
        );
        expect(text).toContain('Heads up');
        expect(text).toContain('One');
        expect(text).not.toContain(':::');
        expect(text).not.toContain('::tab');
    });

    test('math keeps its source without delimiters', () => {
        expect(toText('Euler: $$ e^{i_x} $$')).toBe('Euler: e^{i_x}');
        expect(toText(':::math\na_b\n:::')).toBe('a_b');
    });
});

describe('headings with math', () => {
    test('inline math in a heading yields a clean id and toc text', async () => {
        const { prepareMarkdownPage } = await import('../src/lib/markdown');
        const { html, headings } = await prepareMarkdownPage('## Title $$ x^2 $$\n\ntext');
        expect(html).toContain('id="title-x2"');
        expect(headings).toEqual([{ id: 'title-x2', text: 'Title x^2', level: 2 }]);
    });
});

describe('references block', () => {
    test('an indented closing marker still closes the block', async () => {
        const html = await render('Claim[^a].\n\n:::references\n[^a]:\n    Source text.\n    :::');
        expect(html).toContain('Source text.');
        expect(html).toContain('References');
        expect(html).not.toContain(':::');
    });

    test('a normal closing marker keeps working', async () => {
        const html = await render('Claim[^a].\n\n:::references\n[^a]: Source.\n:::');
        expect(html).toContain('Source.');
    });
});

describe('containers inside lists and blockquotes', () => {
    const within = (html: string, outer: string, inner: string) => {
        const start = html.indexOf(`<${outer}`);
        const end = html.indexOf(`</${outer}>`);
        const at = html.indexOf(inner);
        return start !== -1 && at > start && at < end;
    };

    test('a note stays inside its list item', async () => {
        const html = await render('- item\n\n  :::note\n  inner **bold**\n  :::\n\n- next');
        expect(html).toContain('markdown-alert-note');
        expect(within(html, 'li', 'markdown-alert-note')).toBe(true);
        expect(html.match(/<li/g)?.length).toBe(2);
        expect(html).not.toContain(':::');
    });

    test('numbered list items work without a blank line', async () => {
        const html = await render('1. item\n   :::note\n   inner\n   :::\n2. next');
        expect(within(html, 'li', 'markdown-alert-note')).toBe(true);
        expect(html.match(/<li/g)?.length).toBe(2);
    });

    test('a note inside a blockquote stays in the blockquote', async () => {
        const html = await render('> :::note\n> inner **bold**\n> :::');
        expect(within(html, 'blockquote', 'markdown-alert-note')).toBe(true);
        expect(html).not.toContain(':::');
    });

    test('tabs work inside a blockquote', async () => {
        const html = await render('> :::tabs\n> ::tab label="A"\n> one\n> ::\n> :::');
        expect(within(html, 'blockquote', 'data-tab-label="A"')).toBe(true);
    });

    test(':::math works inside list items and blockquotes', async () => {
        const list = await render('- a\n\n  :::math\n  x^2\n  :::\n\n- b');
        expect(within(list, 'li', 'katex-block')).toBe(true);
        const quote = await render('> :::math\n> x^2\n> :::');
        expect(within(quote, 'blockquote', 'katex-block')).toBe(true);
        expect(quote).not.toContain('@@');
    });

    test('a quote that ends early leaves the container literal', async () => {
        const html = await render('> :::note\n> inner\n\nplain paragraph');
        expect(html).toContain(':::note');
        expect(html).toContain('plain paragraph');
        expect(html).not.toContain('markdown-alert');
    });
});
