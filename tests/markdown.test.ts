import { beforeAll, describe, expect, test } from 'bun:test';

let render: (markdown: string) => Promise<string>;
let getDownloadFilename: (className: string, filename?: string) => string;

beforeAll(async () => {
    const markdown = await import('../packages/lib/src/markdown');
    render = markdownSource => markdown.renderMarkdown(markdownSource);
    getDownloadFilename = (await import('../packages/lib/src/utils/codeBlockExtensions'))
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

    test('github alerts render as callouts and unknown kinds stay blockquotes', async () => {
        const html = await render('> [!NOTE]\n> hello');
        expect(html).toContain('mdrs-alert mdrs-alert--note');
        expect(html).toContain('hello');
        expect(html).not.toContain('<blockquote>');
        const other = await render('> [!FOO]\n> hello');
        expect(other).toContain('<blockquote>');
        expect(other).not.toContain('mdrs-alert');
    });
});

describe('code fences', () => {
    test('filename and mark are exposed on the pre element', async () => {
        const html = await render(
            '```python filename="main.py" mark=1,3,5..6\na\nb\nc\nd\ne\nf\ng\n```'
        );
        expect(html).toContain('data-mdrs-highlight-lines="1,3,5,6"');
        expect(html).toContain('data-mdrs-filename="main.py"');
        expect(html).toContain('class="language-python"');
    });

    test('filename and mark are both optional', async () => {
        const plain = await render('```ts\nx\n```');
        expect(plain).not.toContain('data-filename');
        expect(plain).not.toContain('data-highlight-lines');
        const onlyName = await render('```ts filename="a.ts"\nx\n```');
        expect(onlyName).toContain('data-mdrs-filename="a.ts"');
        const onlyMark = await render('```ts mark=1\nx\n```');
        expect(onlyMark).toContain('data-mdrs-highlight-lines="1"');
    });

    test('mark ranges are clamped and invalid parts are ignored', async () => {
        const html = await render('```ts mark=2..99,x,5-6,0\na\nb\nc\n```');
        expect(html).toContain('data-mdrs-highlight-lines="2,3"');
    });

    test('old brace syntax no longer marks lines', async () => {
        const html = await render('```ts {1}\na\n```');
        expect(html).not.toContain('data-highlight-lines');
    });

    test('filename is escaped', async () => {
        const html = await render('```ts filename="a&b.ts"\nx\n```');
        expect(html).toContain('data-mdrs-filename="a&amp;b.ts"');
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
            expect(html).toContain(`mdrs-alert mdrs-alert--${type}`);
            expect(html).toContain('<strong>world</strong>');
            expect(html).not.toContain(':::');
        }
    );

    test('custom callout with title and icon', async () => {
        const html = await render(':::callout title="Pro <Tip>" icon="rocket"\nbody\n:::');
        expect(html).toContain('mdrs-callout');
        expect(html).toContain('<span>Pro &lt;Tip&gt;</span>');
        expect(html).toContain('mdrs-icon-rocket');
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
        expect(html).toContain('mdrs-define-error');
        expect(html).not.toContain('mdrs-callout"');
    });

    test('old brace attribute syntax is not accepted', async () => {
        const html = await render(':::callout{title="T"}\nbody\n:::');
        expect(html).not.toContain('mdrs-callout');
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
        expect(html).toContain('mdrs-math--block');
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
        expect(html).toContain('mdrs-alert--note');
        expect(html).toContain('class="katex"');
    });
});

describe('tabs and snippets', () => {
    const tabs = (name: string, attrs = '') =>
        `:::${name}${attrs}\n::tab label="A" icon="zap"\nfirst\n::\n::tab label="B <b>"\nsecond\n::\n:::`;

    test(':::tabs renders content tabs without a sync key', async () => {
        const html = await render(tabs('tabs', ' key="x"'));
        expect(html).toContain('mdrs-tabs');
        expect(html).not.toContain('mdrs-snippets');
        expect(html).not.toContain('data-tab-group-key');
        expect(html).toContain('data-mdrs-tab-label="A"');
        expect(html).toContain('mdrs-icon-zap');
        expect(html).toContain('data-mdrs-tab-label="B &lt;b&gt;"');
        expect(html).toContain('<p>first</p>');
    });

    test(':::snippets renders code tabs with an optional key', async () => {
        const keyed = await render(tabs('snippets', ' key="pm"'));
        expect(keyed).toContain('mdrs-snippets');
        expect(keyed).toContain('data-mdrs-tab-key="pm"');
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
        expect(html).toContain('mdrs-define-error');
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
        expect(html).toContain('mdrs-steps-list');
        expect(html).toContain('mdrs-alert--note');
        expect(html.match(/role="tabpanel"/g)?.length).toBe(2);
        expect(html).not.toContain(':::');
    });

    test('a missing :: before ::: still closes the tab', async () => {
        const html = await render(':::tabs\n::tab label="A"\nx\n:::\n\nafter');
        expect(html).toContain('data-mdrs-tab-label="A"');
        expect(html).toContain('<p>after</p>');
    });
});

describe('details', () => {
    test(':::details renders a collapsible card', async () => {
        const html = await render(':::details summary="More <info>"\n- a\n- b\n:::');
        expect(html).toContain('mdrs-details');
        expect(html).toContain('More &lt;info&gt;');
        expect(html).toContain('mdrs-list-item');
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
        expect(html).toContain('mdrs-define-error');
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
        expect(await render(':::embed')).toContain('mdrs-define-error');
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
        expect(html).not.toContain('mdrs-alert');
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
        resolve = (await import('../packages/lib/src/markdownIcons')).resolveIconMarkup;
    });

    test('lucide wins when the name exists in both libraries', async () => {
        expect(await resolve('list')).toContain('mdrs-icon mdrs-icon-list"');
        expect(await resolve('rocket')).toContain('<path');
    });

    test('falls back to bootstrap when lucide has no such icon', async () => {
        expect(await resolve('facebook')).toBe(
            '<i class="mdrs-icon bi bi-facebook" aria-hidden="true"></i>'
        );
    });

    test('prefixes force the library', async () => {
        expect(await resolve('lucide-rocket')).toContain('mdrs-icon-rocket');
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
        expect(html).toContain('data-mdrs-filename="a$&amp;b$&#39;d.js"');
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
        expect(empty).toContain('mdrs-define-error');
        expect(empty).not.toContain('<pre>');
        const upper = await render(':::TABS\n::TAB label="A"\nx\n::\n:::');
        expect(upper).toContain('data-mdrs-tab-label="A"');
    });

    test('four-space indented directives are code, not directives', async () => {
        const html = await render('    :::note\n    x\n    :::');
        expect(html).not.toContain('mdrs-alert');
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
        expect(html).toContain('mdrs-icon-rocket');
    });
});

describe('plain text export', () => {
    let toText: (markdown: string) => string;

    beforeAll(async () => {
        toText = (await import('../packages/lib/src/utils/markdownToText')).markdownToPlainText;
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

    test('only leading frontmatter is dropped, not text between thematic breaks', () => {
        expect(toText('---\ntitle: x\n---\n\nBody')).toBe('Body');
        expect(toText('Intro\n\n---\n\nMiddle\n\n---\n\nEnd')).toBe('Intro\n\nMiddle\n\nEnd');
    });

    test('math keeps its source without delimiters', () => {
        expect(toText('Euler: $$ e^{i_x} $$')).toBe('Euler: e^{i_x}');
        expect(toText(':::math\na_b\n:::')).toBe('a_b');
    });
});

describe('headings with math', () => {
    test('inline math in a heading yields a clean id and toc text', async () => {
        const { prepareMarkdownPage } = await import('../packages/lib/src/markdown');
        const { html, headings } = await prepareMarkdownPage('## Title $$ x^2 $$\n\ntext');
        expect(html).toContain('id="mdrs-title-x2"');
        expect(headings).toEqual([{ id: 'mdrs-title-x2', text: 'Title x^2', level: 2 }]);
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
        expect(html).toContain('mdrs-alert--note');
        expect(within(html, 'li', 'mdrs-alert--note')).toBe(true);
        expect(html.match(/<li/g)?.length).toBe(2);
        expect(html).not.toContain(':::');
    });

    test('numbered list items work without a blank line', async () => {
        const html = await render('1. item\n   :::note\n   inner\n   :::\n2. next');
        expect(within(html, 'li', 'mdrs-alert--note')).toBe(true);
        expect(html.match(/<li/g)?.length).toBe(2);
    });

    test('a note inside a blockquote stays in the blockquote', async () => {
        const html = await render('> :::note\n> inner **bold**\n> :::');
        expect(within(html, 'blockquote', 'mdrs-alert--note')).toBe(true);
        expect(html).not.toContain(':::');
    });

    test('tabs work inside a blockquote', async () => {
        const html = await render('> :::tabs\n> ::tab label="A"\n> one\n> ::\n> :::');
        expect(within(html, 'blockquote', 'data-mdrs-tab-label="A"')).toBe(true);
    });

    test(':::math works inside list items and blockquotes', async () => {
        const list = await render('- a\n\n  :::math\n  x^2\n  :::\n\n- b');
        expect(within(list, 'li', 'mdrs-math--block')).toBe(true);
        const quote = await render('> :::math\n> x^2\n> :::');
        expect(within(quote, 'blockquote', 'mdrs-math--block')).toBe(true);
        expect(quote).not.toContain('@@');
    });

    test('a quote that ends early leaves the container literal', async () => {
        const html = await render('> :::note\n> inner\n\nplain paragraph');
        expect(html).toContain(':::note');
        expect(html).toContain('plain paragraph');
        expect(html).not.toContain('mdrs-alert');
    });
});

describe('drop-in compatibility', () => {
    test('interpolation stays literal without a :::define block', async () => {
        const html = await render('Template: ${name} and [a].${b}');
        expect(html).toContain('Template: ${name} and [a].${b}');
        expect(html).not.toContain('mdrs-define-error');
    });

    test('interpolation runs when :::define has entries', async () => {
        const html = await render(':::define\nn: 3\n:::\n\n${n}');
        expect(html).toContain('<p>3</p>');
    });

    test('an empty :::define block does not switch interpolation on', async () => {
        const html = await render(':::define\n:::\n\n${n}');
        expect(html).toContain('${n}');
        expect(html).not.toContain(':::define');
    });

    test('a backslash keeps ${ literal', async () => {
        const html = await render(':::define\nn: 3\n:::\n\n\\${n} is ${n}');
        expect(html).toContain('${n} is 3');
    });

    test('interpolation inside conditional text is evaluated', async () => {
        const html = await render(':::define\nn: 3\nok: true\n:::\n\n[Value ${n}].${ok}');
        expect(html).toContain('Value 3');
        expect(html).not.toContain('${n}');
    });

    test('prices with $$ stay text and real inline math still renders', async () => {
        const prices = await render('Costs $$5 and $$10, but $$x^2$$ is math');
        expect(prices).toContain('Costs $$5 and $$10, but');
        expect(prices.match(/class="katex"/g)).toHaveLength(1);
        expect(await render('$$ x = 3 $$')).toContain('class="katex"');
    });

    test('numbered task items keep their state', async () => {
        const html = await render('1. [x] done\n2. [-] skipped');
        expect(html).toContain('<ol class="mdrs-list mdrs-list--ordered">');
        expect(html).toContain('mdrs-task--done');
        expect(html).toContain('mdrs-task--skipped');
        expect(html).toContain('<span class="mdrs-sr-only">Done: </span>');
    });

    test('loose lists keep their paragraphs', async () => {
        const html = await render('- a\n\n- b');
        expect(html).toContain('mdrs-list--loose');
        expect(html).toContain('<p>a</p>');
        expect(await render('- a\n- b')).not.toContain('<p>');
    });

    test('semantic html tags survive', async () => {
        const html = await render('<dl><dt>T</dt><dd>D</dd></dl>\n\n<q>quote</q> <small>s</small>');
        expect(html).toContain('<dl><dt>T</dt><dd>D</dd></dl>');
        expect(html).toContain('<q>quote</q>');
        expect(html).toContain('<small>s</small>');
    });

    test('a numbered footnote-like line is not rewritten', async () => {
        const html = await render('Text[^a]\n\n1. [^a]: text');
        expect(html).toContain('<ol class="mdrs-list mdrs-list--ordered">');
    });

    test('urls containing @@ keep their href and sentinels are stripped', async () => {
        expect(await render('[l](https://x.test/@@y)')).toContain('href="https://x.test/@@y"');
        expect(await render('a\uE000IGNORE_RENDER_0\uE001b')).toContain('<p>aIGNORE_RENDER_0b</p>');
    });

    test('a punctuation-only heading gets a fallback id', async () => {
        const { prepareMarkdownPage } = await import('../packages/lib/src/markdown');
        const { html } = await prepareMarkdownPage('## !!!\n\n## Main');
        expect(html).toContain('id="mdrs-heading-0"');
        expect(html).toContain('id="mdrs-main"');
    });

    test('same-document links follow the prefixed heading ids', async () => {
        const { prepareMarkdownPage } = await import('../packages/lib/src/markdown');
        const { html } = await prepareMarkdownPage('## Setup\n\nSee [setup](#setup).');
        expect(html).toContain('href="#mdrs-setup"');
    });

    test('a longer ignore-render fence can hold a ::: line', async () => {
        const html = await render('::::ignore-render\n:::note\nx\n:::\n::::');
        expect(html).toContain('<pre>:::note\nx\n:::</pre>');
    });
});

describe('scanner robustness', () => {
    test('code spans follow CommonMark backtick matching', async () => {
        const html = await render(':::define\nn: 2\n:::\n\n``a ${n} `` and ```b ${n}`` ${n}');
        expect(html).toContain('<code>a ${n} </code>');
        expect(html).not.toContain('<code>b');
        expect(html).toContain('```b 2`` 2');
    });

    test('an unclosed fence protects everything after it', async () => {
        const html = await render(':::define\nn: 2\n:::\n\n```\n${n}\n:::note\nx');
        expect(html).toContain('${n}');
        expect(html).not.toContain('mdrs-alert');
    });

    test('adversarial input renders in bounded time', async () => {
        const started = performance.now();
        await render('`'.repeat(200_000));
        await render('$$ ' + 'a '.repeat(100_000));
        await render(':::define\nn: 1\n:::\n' + '['.repeat(100_000));
        await render(':::define\nn: 1\n:::\n' + '${'.repeat(50_000));
        await render(':::math\n:::ignore-render\nx\n'.repeat(10_000));
        expect(performance.now() - started).toBeLessThan(5000);
    });
});
