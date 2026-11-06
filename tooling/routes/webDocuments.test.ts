// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, test } from 'bun:test';
import { slot } from './support.ts';

const state = {
    post: null as Record<string, unknown> | null,
    postError: false,
    markdown: '## Heading\n\nBody **bold**' as string | null,
    legal: { slug: 'privacy', title: 'Privacy', content: 'Legal **text**' } as Record<
        string,
        unknown
    > | null,
    legalError: false
};

const blogRoute =
    await import('../../apps/web/src/routes/blog/[slug].[format=textformat]/+server.ts');
const loaders = await Promise.all(
    ['privacy', 'terms', 'security', 'ai-disclosure'].map(
        async name =>
            [
                name,
                ((await import(`../../apps/web/src/routes/${name}/+page.server.ts`)) as any).load
            ] as const
    )
);
const legalRoute =
    await import('../../apps/web/src/routes/[page=legal].[format=textformat]/+server.ts');

function post(extra: Record<string, unknown> = {}) {
    return {
        title: 'Post Title',
        slug: 'post-title',
        source: 'posts/post-title.md',
        excerpt: 'Short excerpt',
        banner_url: null,
        banner_credit: null,
        content_license: null,
        ...extra
    };
}

beforeEach(() => {
    state.post = post();
    state.postError = false;
    state.markdown = '## Heading\n\nBody **bold**';
    state.legal = { slug: 'privacy', title: 'Privacy', content: 'Legal **text**' };
    state.legalError = false;
    slot.publicRepositories = () => ({
        blog: {
            getPublishedBySlug: async () => {
                if (state.postError) throw new Error('db');
                return state.post;
            },
            readMarkdown: async () => state.markdown
        },
        legal: {
            page: async () => {
                if (state.legalError) throw new Error('db');
                return state.legal;
            }
        },
        site: { contentLicense: async () => ({ license: 'CC0-1.0' }) }
    });
});

const blog = (slug: string, format: 'md' | 'txt') =>
    (blogRoute as any).GET({
        params: { slug, format },
        fetch: globalThis.fetch
    }) as Promise<Response>;
const legal = (page: string, format: 'md' | 'txt') =>
    (legalRoute as any).GET({ params: { page, format } }) as Promise<Response>;

describe('blog documents', () => {
    test('returns 404 for invalid or missing posts', async () => {
        for (const response of [
            await blog('Not A Slug!', 'md'),
            await (async () => {
                state.post = null;
                return blog('post-title', 'md');
            })(),
            await (async () => {
                state.postError = true;
                return blog('post-title', 'md');
            })()
        ]) {
            expect(response.status).toBe(404);
            expect(response.headers.get('cache-control')).toBe('no-store');
        }
    });

    test('renders Markdown with the license notice', async () => {
        const response = await blog('post-title', 'md');
        expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
        expect(response.headers.get('x-robots-tag')).toBe('noindex');
        const body = await response.text();
        expect(body).toStartWith('# Post Title\n\n## Heading');
        expect(body).toContain('---');
        expect(body).toMatch(/CC0|public domain/i);
    });

    test('renders plain text with the excerpt and banner credit', async () => {
        state.post = post({
            banner_url: 'https://cdn.test/banner.webp',
            banner_credit: {
                origin: 'third-party',
                author: 'Photographer',
                url: null,
                license: null
            }
        });
        const response = await blog('post-title', 'txt');
        expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
        const body = await response.text();
        expect(body).toStartWith('Post Title\n\nShort excerpt\n\nHeading');
        expect(body).not.toContain('**bold**');
        expect(body).toContain('Photographer');
    });

    test('falls back to the excerpt when the Markdown is empty', async () => {
        state.markdown = null;
        expect(await (await blog('post-title', 'md')).text()).toContain('Short excerpt');
        state.post = post({ excerpt: null });
        state.markdown = '';
        const text = await (await blog('post-title', 'txt')).text();
        expect(text).toStartWith('Post Title\n\n');
    });
});

describe('legal documents', () => {
    test('returns 404 when the page has no content', async () => {
        state.legal = null;
        expect((await legal('privacy', 'md')).status).toBe(404);
        state.legalError = true;
        expect((await legal('privacy', 'txt')).status).toBe(404);
    });

    test('renders Markdown and plain text', async () => {
        expect(await (await legal('privacy', 'md')).text()).toBe('Legal **text**');
        const text = await (await legal('privacy', 'txt')).text();
        expect(text).toStartWith('Privacy\n\nLegal text');
        state.legal = { slug: 'privacy', title: '', content: 'Legal **text**' };
        expect(await (await legal('privacy', 'txt')).text()).toBe('Legal text');
    });
});

describe('legal page loaders', () => {
    for (const [name, load] of loaders) {
        test(`${name} renders the stored page and 404s when empty`, async () => {
            const url = new URL(`https://ada.test/${name}`);
            const data = await load({ url });
            expect(data.pageData.content).toBe('Legal **text**');
            expect(data.html).toContain('<strong>text</strong>');
            state.legal = { slug: name, title: '', content: '  ' };
            const failure = await load({ url }).catch((error: { status: number }) => error);
            expect(failure.status).toBe(404);
        });
    }
});
