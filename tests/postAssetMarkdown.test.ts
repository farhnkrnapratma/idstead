import { describe, expect, test } from 'bun:test';
import { renderMarkdown } from '../packages/mdrs/src/markdown.ts';

const cdn = 'https://cdn.example.com';

describe('post asset markdown', () => {
    test('post images render AVIF with a WebP fallback', async () => {
        const html = await renderMarkdown(
            `![Ubuntu release](${cdn}/blog/ubuntu-26-10/images/ubuntu-release.avif "Ubuntu release")`
        );
        expect(html).toContain(
            `<source srcset="${cdn}/blog/ubuntu-26-10/images/ubuntu-release.avif" type="image/avif">`
        );
        expect(html).toContain(`src="${cdn}/blog/ubuntu-26-10/images/ubuntu-release.webp"`);
        expect(html).toContain('alt="Ubuntu release"');
        expect(html).toContain('title="Ubuntu release"');
    });

    test('staged images also get the fallback', async () => {
        const html = await renderMarkdown(
            `![Shot](${cdn}/staging/blog/0b6f3c1e-8f5a-4c2b-9d7e-1a2b3c4d5e6f/images/shot.avif)`
        );
        expect(html).toContain('<picture>');
        expect(html).toContain('/images/shot.webp"');
    });

    test('other images stay a plain img', async () => {
        const html = await renderMarkdown('![Logo](https://example.org/logo.avif)');
        expect(html).not.toContain('<picture>');
    });

    test('WebM videos render as video', async () => {
        const html = await renderMarkdown(
            `![Demo clip](${cdn}/blog/post/videos/demo-clip.webm "Demo clip")`
        );
        expect(html).toContain(
            `<video controls preload="metadata" playsinline src="${cdn}/blog/post/videos/demo-clip.webm"`
        );
    });
});
