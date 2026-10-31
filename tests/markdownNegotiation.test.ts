import { describe, expect, test } from 'bun:test';
import {
    estimateTokens,
    htmlToMarkdown,
    markdownResponse,
    markdownSourcePath,
    negotiablePath,
    prefersMarkdown,
    varyOnAccept
} from '../packages/lib/src/server/markdownNegotiation.ts';

describe('markdown negotiation', () => {
    test('serves markdown only when it is asked for at least as strongly as HTML', () => {
        expect(prefersMarkdown('text/markdown')).toBe(true);
        expect(prefersMarkdown('text/markdown, text/html;q=0.9')).toBe(true);
        expect(prefersMarkdown('text/markdown;q=0.5, */*;q=0.1')).toBe(true);
        expect(
            prefersMarkdown('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
        ).toBe(false);
        expect(prefersMarkdown('text/html, text/markdown;q=0.5')).toBe(false);
        expect(prefersMarkdown('text/markdown;q=0')).toBe(false);
        expect(prefersMarkdown(null)).toBe(false);
    });

    test('negotiates pages only, never API, discovery or file routes', () => {
        expect(negotiablePath('/')).toBe(true);
        expect(negotiablePath('/blog/hello')).toBe(true);
        expect(negotiablePath('/api/internal/feedback')).toBe(false);
        expect(negotiablePath('/.well-known/api-catalog')).toBe(false);
        expect(negotiablePath('/privacy.md')).toBe(false);
    });

    test('posts and legal pages use their markdown source', () => {
        expect(markdownSourcePath('/blog/hello-world')).toBe('/blog/hello-world.md');
        expect(markdownSourcePath('/privacy/')).toBe('/privacy.md');
        expect(markdownSourcePath('/ai-disclosure')).toBe('/ai-disclosure.md');
        expect(markdownSourcePath('/blog')).toBeNull();
        expect(markdownSourcePath('/')).toBeNull();
    });

    test('converts the main content with title and description frontmatter', () => {
        const html = `<html><head><title>Ada &amp; Co</title><meta name="description" content="A &quot;site&quot;"></head>
            <body><nav><a href="/">Home</a></nav><main id="main"><h1>Hello</h1><p>Read <a href="/blog">the blog</a>.</p>
            <ul><li>One</li><li>Two</li></ul><img src="/banner.webp" alt=""><img src="/a.webp" alt="Avatar"><a href="/contact"> <span>Get in touch</span> </a><button>Copy</button><footer>Footer links</footer></main><script>x()</script></body></html>`;
        const markdown = htmlToMarkdown(html);
        expect(
            markdown.startsWith(
                '---\ntitle: "Ada & Co"\ndescription: "A \\"site\\""\n---\n\n# Hello'
            )
        ).toBe(true);
        expect(markdown).toContain('[the blog](/blog)');
        expect(markdown).toContain('- One');
        expect(markdown).not.toContain('/banner.webp');
        expect(markdown).toContain('![Avatar](/a.webp)');
        expect(markdown).toContain('[Get in touch](/contact)');
        expect(markdown).not.toContain('Footer links');
        expect(markdown).not.toContain('Copy');
        expect(markdown).not.toContain('Home');
    });

    test('markdown responses keep links and caching, drop HTML-only headers', async () => {
        const source = new Response('<p>x</p>', {
            headers: {
                'Content-Type': 'text/html',
                'Content-Security-Policy': "default-src 'self'",
                ETag: '"abc"',
                'Cache-Control': 'public, max-age=60',
                Link: '</.well-known/api-catalog>; rel="api-catalog"'
            }
        });
        const response = markdownResponse('# Title\n', source, 'GET');
        expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
        expect(response.headers.get('vary')).toBe('Accept');
        expect(response.headers.get('x-markdown-tokens')).toBe(String(estimateTokens('# Title\n')));
        expect(response.headers.get('link')).toContain('api-catalog');
        expect(response.headers.get('cache-control')).toBe('public, max-age=60');
        expect(response.headers.has('content-security-policy')).toBe(false);
        expect(response.headers.has('etag')).toBe(false);
        expect(await response.text()).toBe('# Title\n');
        expect(await markdownResponse('# T', source, 'HEAD').text()).toBe('');
    });

    test('HTML responses vary on Accept so caches keep both representations apart', () => {
        const html = varyOnAccept(new Response('', { headers: { 'Content-Type': 'text/html' } }));
        expect(html.headers.get('vary')).toBe('Accept');
        const json = varyOnAccept(
            new Response('', { headers: { 'Content-Type': 'application/json' } })
        );
        expect(json.headers.has('vary')).toBe(false);
    });
});
