// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, test } from 'bun:test';
import { slot } from './support.ts';

const PUBLIC_ID = 'a'.repeat(64);

const state = {
    profile: null as Record<string, unknown> | null,
    posts: [] as unknown[],
    postsError: false,
    license: 'CC-BY-4.0' as string | Error,
    lookup: { status: 'found', post: { id: 'p1' } } as Record<string, unknown>,
    data: undefined as any,
    salt: 'salt' as string | null,
    counted: true,
    recordError: false,
    recorded: [] as unknown[]
};

const profile = {
    name: 'Ada & Co',
    username: 'ada',
    bio: 'Bio <b>',
    headline: 'Engineer',
    email: 'ada@example.com',
    siteUrl: 'https://ada.test',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z'
};

function post(index: number, extra: Record<string, unknown> = {}) {
    return {
        id: `id-${index}`,
        slug: `post ${index}`,
        title: `Post <${index}>`,
        excerpt: index % 2 ? `Excerpt ${index}` : null,
        created_at: '2026-02-01T00:00:00.000Z',
        updated_at: null,
        content_license: null,
        ...extra
    };
}

const atom = await import('../../apps/web/src/routes/atom.xml/+server.ts');
const views = await import('../../apps/web/src/routes/api/internal/blog/views/+server.ts');

beforeEach(() => {
    state.profile = profile;
    state.posts = [];
    state.postsError = false;
    state.license = 'CC-BY-4.0';
    state.lookup = { status: 'found', post: { id: 'p1' } };
    state.salt = 'salt';
    state.counted = true;
    state.recordError = false;
    state.recorded = [];
    slot.publicRepositories = () => ({
        author: { profile: async () => state.profile },
        blog: {
            listPublished: async () => {
                if (state.postsError) throw new Error('db');
                return { posts: state.posts };
            }
        },
        site: {
            contentLicense: async () => {
                if (state.license instanceof Error) throw state.license;
                return { license: state.license };
            }
        }
    });
    state.data = {
        blog: { findPublished: async () => state.lookup },
        writers: {
            views: {
                record: async (...args: unknown[]) => {
                    if (state.recordError) throw new Error('db');
                    state.recorded.push(args);
                    return { counted: state.counted, views: 7 };
                }
            }
        }
    };
    slot.serviceData = () => state.data;
    slot.ipSalt = () => state.salt;
});

async function failure(promise: Promise<Response>) {
    try {
        return (await promise).status;
    } catch (error) {
        return (error as { status: number }).status;
    }
}

describe('GET /atom.xml', () => {
    const { GET } = atom as any;
    const get = (platform: unknown = {}) =>
        GET({ request: new Request('https://ada.test/atom.xml'), platform });

    test('renders entries with per-post licenses', async () => {
        state.posts = [
            post(1),
            post(2, { updated_at: '2026-05-01T00:00:00.000Z', content_license: 'CC0-1.0' }),
            post(3, { content_license: 'CC-BY-4.0' })
        ];
        const response = await get();
        const body = await response.text();
        expect(response.headers.get('content-type')).toBe('application/atom+xml; charset=utf-8');
        expect(body).toContain('<title>ada.test — Blog</title>');
        expect(body).toContain('<subtitle>Bio &lt;b&gt;</subtitle>');
        expect(body).toContain('<name>Ada &amp; Co</name><email>ada@example.com</email>');
        expect(body).toContain('<updated>2026-05-01T00:00:00.000Z</updated>');
        expect(body.match(/<rights>/g)).toHaveLength(2);
        expect(body).toContain('<summary type="text">Excerpt 1</summary>');
        expect(body).toContain('<summary type="text"></summary>');
    });

    test('falls back to the host and default license without a profile', async () => {
        state.profile = null;
        state.license = new Error('db');
        const body = await (await get({ env: { PUBLIC_SITE_URL: 'https://cfg.test' } })).text();
        expect(body).toContain('<name>cfg.test</name>');
        expect(body).not.toContain('<subtitle>');
        expect(body).not.toContain('<email>');
        expect(body).toMatch(/<updated>\d{4}-/);
    });

    test('omits optional profile fields', async () => {
        state.profile = { ...profile, bio: '', email: null, name: '' };
        const body = await (await get()).text();
        expect(body).toContain('<name>ada.test</name>');
        expect(body).not.toContain('<email>');
    });

    test('fails closed when the feed cannot be built', async () => {
        state.postsError = true;
        expect(await failure(get())).toBe(503);
        state.postsError = false;
        state.posts = [post(1, { created_at: 'bad' })];
        expect(await failure(get())).toBe(503);
    });
});

describe('POST /api/internal/blog/views', () => {
    const { POST } = views as any;
    const call = (body: unknown, init: { origin?: string; raw?: string } = {}) =>
        POST({
            request: new Request('https://ada.test/api/internal/blog/views', {
                method: 'POST',
                headers: { origin: init.origin ?? 'https://ada.test' },
                body: init.raw ?? JSON.stringify(body)
            }),
            url: new URL('https://ada.test/api/internal/blog/views'),
            getClientAddress: () => '203.0.113.4',
            platform: {}
        }) as Promise<Response>;
    const code = async (response: Response) => ((await response.json()) as any).code;

    test('rejects cross-origin requests and missing storage', async () => {
        expect((await call({}, { origin: 'https://evil.test' })).status).toBe(403);
        state.data = undefined;
        const response = await call({ postId: PUBLIC_ID });
        expect(response.status).toBe(503);
        expect(await code(response)).toBe('BLOG_VIEW_UNAVAILABLE');
    });

    test('validates the post id', async () => {
        expect(await code(await call({}))).toBe('BLOG_VIEW_POST_ID_REQUIRED');
        expect(await code(await call({ postId: '  ' }))).toBe('BLOG_VIEW_POST_ID_REQUIRED');
        expect(await code(await call(null))).toBe('BLOG_VIEW_POST_ID_REQUIRED');
        expect(await code(await call({ postId: 'not-a-hash' }))).toBe('BLOG_POST_NOT_FOUND');
        state.lookup = { status: 'missing' };
        expect((await call({ postId: PUBLIC_ID })).status).toBe(404);
    });

    test('needs the ip salt', async () => {
        state.salt = null;
        const response = await call({ postId: PUBLIC_ID });
        expect(response.status).toBe(503);
    });

    test('records a new and a repeat view', async () => {
        const first = await call({ postId: ` ${PUBLIC_ID} ` });
        expect(first.status).toBe(201);
        expect(await first.json()).toEqual({ counted: true, views: 7 });
        const [, visitorKey] = state.recorded[0] as [unknown, string];
        expect(visitorKey).toMatch(/^\d{4}-\d{2}-\d{2}_[0-9a-f]+$/);
        state.counted = false;
        expect((await call({ postId: PUBLIC_ID })).status).toBe(200);
    });

    test('reports tracking failures', async () => {
        state.recordError = true;
        const response = await call({ postId: PUBLIC_ID });
        expect(response.status).toBe(500);
        expect(await code(response)).toBe('BLOG_VIEW_TRACKING_FAILED');
        expect(await code(await call(null, { raw: '{' }))).toBe('BLOG_VIEW_TRACKING_FAILED');
    });
});
