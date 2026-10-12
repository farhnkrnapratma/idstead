import { describe, expect, setDefaultTimeout, test } from 'bun:test';

setDefaultTimeout(20_000);

const baseUrl = process.env.API_TEST_BASE_URL?.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const POST_ID_RE = /^[0-9a-f]{64}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual', ...init });
    if (response.status === 429) {
        throw new Error(
            `Rate limited by ${baseUrl}; retry after ${response.headers.get('retry-after') ?? 60}s.`
        );
    }
    return response;
}

function api(path: string, init?: RequestInit) {
    return request(`/api/v1${path}`, init);
}

function expectNoInternalIds(value: unknown, path = '$') {
    if (Array.isArray(value)) {
        value.forEach((item, index) => expectNoInternalIds(item, `${path}[${index}]`));
        return;
    }
    if (value && typeof value === 'object') {
        for (const [key, nested] of Object.entries(value)) {
            expect(`${path}.${key}`).not.toMatch(/(^|\.)\w+_id$/);
            if (key === 'id') expect(String(nested)).toMatch(POST_ID_RE);
            expectNoInternalIds(nested, `${path}.${key}`);
        }
        return;
    }
    if (typeof value === 'string') expect(value).not.toMatch(UUID_RE);
}

async function getJson(path: string, init?: RequestInit) {
    const response = await api(path, init);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    const body = (await response.json()) as any;
    expectNoInternalIds(body);
    return { response, body };
}

async function getText(path: string, type: string, init?: RequestInit) {
    const response = await api(path, init);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain(type);
    const text = await response.text();
    expect(text).not.toMatch(UUID_RE);
    return text;
}

async function expectApiError(path: string, status: number, code: string, init?: RequestInit) {
    const response = await api(path, init);
    expect(response.status).toBe(status);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    const body = (await response.json()) as any;
    expect(Object.keys(body)).toEqual(['error']);
    expect(body.error.code).toBe(code);
    expect(typeof body.error.message).toBe('string');
    return body.error as { code: string; message: string; details?: string };
}

async function discoverPost() {
    const response = await api('/blog?limit=1');
    if (!response.ok) throw new Error(`GET ${baseUrl}/api/v1/blog returned ${response.status}.`);
    const body = (await response.json()) as any;
    return (body.data?.[0] ?? null) as { id: string; slug: string; title: string } | null;
}

const post = baseUrl ? await discoverPost() : null;

describe.skipIf(!baseUrl)('public API v1', () => {
    describe('discovery', () => {
        test('GET /api/v1 serves the README as markdown with an ETag', async () => {
            const response = await api('');
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toContain('text/markdown');
            expect(await response.text()).toContain('# Public REST API (v1)');

            const etag = response.headers.get('etag');
            expect(etag).toBeTruthy();
            const revalidated = await api('', { headers: { 'If-None-Match': etag! } });
            expect(revalidated.status).toBe(304);
        });

        test('GET /api/v1?output=json and Accept: application/json return the endpoint index', async () => {
            const { body } = await getJson('?o=json');
            expect(body.endpoints.map((e: any) => e.path)).toContain('/api/v1/blog/content');
            const viaAccept = await getJson('', { headers: { Accept: 'application/json' } });
            expect(viaAccept.body).toEqual(body);
        });

        test('GET /api/v1/docs no longer exists', async () => {
            await expectApiError('/docs', 404, 'NOT_FOUND');
        });

        test('GET /api/v1/openapi.json redirects to the canonical JSON spec', async () => {
            const response = await api('/openapi.json');
            expect(response.status).toBe(301);
            expect(response.headers.get('location')).toBe('/.well-known/openapi.json');
            const spec = (await (await request('/.well-known/openapi.json')).json()) as any;
            expect(spec.openapi).toMatch(/^3\./);
            expect(spec.paths).toHaveProperty('/api/v1/blog/content');
            expect(spec.paths).not.toHaveProperty('/api/v1/docs');
        });
    });

    describe('parameters', () => {
        test('unknown parameters are rejected', async () => {
            await expectApiError('/blog?format=md', 400, 'UNKNOWN_PARAMETER');
            await expectApiError('/search?offset=1', 400, 'UNKNOWN_PARAMETER');
        });

        test('a parameter cannot be sent under both its name and its alias', async () => {
            await expectApiError('/author?f=cv&field=cv', 400, 'PARAM_CONFLICT');
        });

        test('aliases and full names produce the same response', async () => {
            const full = await getJson('/author?field=profile,skills');
            const short = await getJson('/author?f=profile&f=skills');
            expect(short.body).toEqual(full.body);
            expect(Object.keys(full.body).sort()).toEqual(['profile', 'skills']);
        });
    });

    describe('blog', () => {
        test('GET /api/v1/blog lists posts with public IDs and pagination', async () => {
            const { body } = await getJson('/blog');
            expect(Array.isArray(body.data)).toBe(true);
            expect(Object.keys(body.pagination).sort()).toEqual(
                ['hasNextPage', 'hasPrevPage', 'limit', 'page', 'total', 'totalPages'].sort()
            );
            for (const item of body.data) expect(item.id).toMatch(POST_ID_RE);
        });

        test('GET /api/v1/blog clamps limit and accepts n/p aliases', async () => {
            const { body } = await getJson('/blog?n=500&p=1');
            expect(body.pagination.limit).toBe(100);
        });

        test('GET /api/v1/blog?o=md returns the markdown catalog', async () => {
            expect(await getText('/blog?o=md', 'text/markdown')).toContain('# Posts Catalog');
        });

        test.skipIf(!post)('GET /api/v1/blog?id= resolves by ID, prefix and slug', async () => {
            const byId = await getJson(`/blog?id=${post!.id}`);
            const byPrefix = await getJson(`/blog?id=${post!.id.slice(0, 7)}`);
            const bySlug = await getJson(`/blog?id=${post!.slug}`);
            expect(byId.body.id).toBe(post!.id);
            expect(byPrefix.body).toEqual(byId.body);
            expect(bySlug.body).toEqual(byId.body);
            expect(typeof byId.body.views_count).toBe('number');
            expect(typeof byId.body.comment_count).toBe('number');
            expect(byId.body).not.toHaveProperty('content');
        });

        test.skipIf(!post)('GET /api/v1/blog?id= offers md and txt', async () => {
            expect(await getText(`/blog?id=${post!.slug}&o=md`, 'text/markdown')).toContain(
                `# ${post!.title}`
            );
            expect(await getText(`/blog?id=${post!.slug}&o=txt`, 'text/plain')).toContain(
                post!.title
            );
        });

        test('GET /api/v1/blog?id= cannot be combined with list parameters', async () => {
            await expectApiError('/blog?id=abcdefg&page=2', 400, 'PARAM_CONFLICT');
        });

        test('unknown and malformed post references are rejected', async () => {
            await expectApiError(
                '/blog?id=this-slug-does-not-exist-12345',
                404,
                'BLOG_POST_NOT_FOUND'
            );
            await expectApiError('/blog?id=Not%20A%20Slug', 400, 'BLOG_POST_ID_INVALID');
            await expectApiError('/blog/content', 400, 'BLOG_POST_ID_REQUIRED');
        });

        test.skipIf(!post)('GET /api/v1/blog/content defaults to markdown', async () => {
            const markdown = await getText(`/blog/content?id=${post!.id}`, 'text/markdown');
            const text = await getText(`/blog/content?id=${post!.id}&o=txt`, 'text/plain');
            const { body } = await getJson(`/blog/content?id=${post!.id}&o=json`);
            expect(body.content).toBe(markdown);
            expect(text.length).toBeGreaterThan(0);
        });

        test('path-style post URLs are gone', async () => {
            await expectApiError(`/blog/${post?.slug ?? 'any-slug'}`, 404, 'NOT_FOUND');
        });
    });

    describe('comments and views', () => {
        test('GET /api/v1/blog/comments returns recent comments without IDs', async () => {
            const { body } = await getJson('/blog/comments?n=5');
            expect(body.data.length).toBeLessThanOrEqual(5);
            for (const comment of body.data) {
                expect(comment.post.id).toMatch(POST_ID_RE);
                expect(typeof comment.is_reply).toBe('boolean');
            }
        });

        test.skipIf(!post)('GET /api/v1/blog/comments?id= nests replies', async () => {
            const { body } = await getJson(`/blog/comments?id=${post!.slug}`);
            expect(body.id).toBe(post!.id);
            expect(typeof body.hasMore).toBe('boolean');
            for (const thread of body.data) expect(Array.isArray(thread.replies)).toBe(true);
        });

        test.skipIf(!post)('GET /api/v1/blog/views?id= returns the count', async () => {
            const { body } = await getJson(`/blog/views?id=${post!.slug}`);
            expect(body).toEqual({ id: post!.id, slug: post!.slug, views: expect.any(Number) });
        });

        test('GET /api/v1/blog/views requires id', async () => {
            await expectApiError('/blog/views', 400, 'BLOG_POST_ID_REQUIRED');
        });
    });

    describe('author and CV', () => {
        test('GET /api/v1/author returns every section by default', async () => {
            const { body } = await getJson('/author');
            expect(body).toHaveProperty('profile');
            expect(typeof body.profile.email).toBe('string');
        });

        test('GET /api/v1/author rejects unknown fields and removed sub-routes', async () => {
            await expectApiError('/author?f=hobbies', 400, 'AUTHOR_FIELD_INVALID');
            await expectApiError('/author/skills', 404, 'NOT_FOUND');
        });

        test('GET /api/v1/cv matches /api/v1/author?field=cv byte for byte', async () => {
            const cv = await api('/cv');
            const author = await api('/author?field=cv');
            expect(cv.status).toBe(200);
            expect(cv.headers.get('location')).toBeNull();
            expect(cv.headers.get('etag')).toBe(author.headers.get('etag'));
            expect(await cv.text()).toBe(await author.text());
        });

        test('HEAD /api/v1/cv?o=pdf sends checksum headers by default', async () => {
            const response = await api('/cv?o=pdf', { method: 'HEAD' });
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toContain('application/pdf');
            expect(response.headers.get('content-disposition')).toMatch(/^attachment;/);
            expect(response.headers.get('x-checksum-sha256')).toMatch(SHA256_RE);
            expect(response.headers.get('repr-digest')).toMatch(/^sha-256=:[A-Za-z0-9+/]+=*:$/);
        });

        test('HEAD /api/v1/cv?o=pdf&c=false omits checksum headers', async () => {
            const response = await api('/cv?o=pdf&c=false', { method: 'HEAD' });
            expect(response.status).toBe(200);
            expect(response.headers.get('x-checksum-sha256')).toBeNull();
            expect(response.headers.get('repr-digest')).toBeNull();
        });

        test('checksum needs PDF output and PDF needs the CV alone', async () => {
            await expectApiError('/cv?checksum=true', 400, 'CV_CHECKSUM_REQUIRES_PDF');
            await expectApiError('/author?f=profile&o=pdf', 400, 'OUTPUT_UNSUPPORTED');
        });
    });

    describe('search', () => {
        test('GET /api/v1/search?q= returns post results with public IDs', async () => {
            const term = post?.title.split(/\s+/).find(word => word.length >= 3) ?? 'linux';
            const { body } = await getJson(`/search?q=${encodeURIComponent(term)}`);
            expect(body.query).toBe(term);
            expect(Object.keys(body.pagination).sort()).toEqual(
                ['hasMore', 'limit', 'page', 'returned'].sort()
            );
        });

        test('GET /api/v1/search?q=a returns an empty result, not a 400', async () => {
            const { body } = await getJson('/search?q=a');
            expect(body.data).toEqual([]);
        });
    });

    describe('cross-cutting behaviour', () => {
        test('unknown routes return the generic NOT_FOUND error', async () => {
            await expectApiError('/this-route-does-not-exist', 404, 'NOT_FOUND');
        });

        test('CORS preflight advertises read-only methods', async () => {
            const response = await api('/blog', {
                method: 'OPTIONS',
                headers: { Origin: 'https://example.com', 'Access-Control-Request-Method': 'GET' }
            });
            expect(response.status).toBe(204);
            expect(response.headers.get('access-control-allow-origin')).toBe('*');
            expect(response.headers.get('access-control-allow-methods')).toBe('GET, HEAD, OPTIONS');
        });

        test('mutating methods are rejected with METHOD_NOT_ALLOWED', async () => {
            const init = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}'
            };
            await expectApiError('/blog/views', 405, 'METHOD_NOT_ALLOWED', init);
            const response = await api('/blog/views', init);
            expect(response.headers.get('allow')).toBe('GET, HEAD, OPTIONS');
        });
    });
});
