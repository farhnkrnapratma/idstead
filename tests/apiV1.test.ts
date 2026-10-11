import { describe, expect, setDefaultTimeout, test } from 'bun:test';

setDefaultTimeout(20_000);

const baseUrl = process.env.API_TEST_BASE_URL?.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

async function getJson(path: string, init?: RequestInit) {
    const response = await api(path, init);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    return { response, body: (await response.json()) as any };
}

async function getText(path: string, type: string, init?: RequestInit) {
    const response = await api(path, init);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain(type);
    return response.text();
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
        test('GET /api/v1 redirects to the markdown docs', async () => {
            const response = await api('');
            expect(response.status).toBe(301);
            expect(response.headers.get('location')).toBe('/api/v1/docs');
        });

        test('GET /api/v1/docs serves the README as markdown with an ETag', async () => {
            const response = await api('/docs');
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toContain('text/markdown');
            expect(await response.text()).toContain('# Public REST API (v1)');

            const etag = response.headers.get('etag');
            expect(etag).toBeTruthy();
            const revalidated = await api('/docs', { headers: { 'If-None-Match': etag! } });
            expect(revalidated.status).toBe(304);
            expect(await revalidated.text()).toBe('');
        });

        test('GET /api/v1/openapi.json redirects to the canonical JSON spec', async () => {
            const response = await api('/openapi.json');
            expect(response.status).toBe(301);
            expect(response.headers.get('location')).toBe('/.well-known/openapi.json');

            const spec = await request('/.well-known/openapi.json');
            expect(spec.status).toBe(200);
            const body = (await spec.json()) as any;
            expect(body.openapi).toMatch(/^3\./);
            expect(body.paths).toHaveProperty('/api/v1/blog');
        });

        test('GET /api/v1/openapi.yaml redirects to the canonical YAML spec', async () => {
            const response = await api('/openapi.yaml');
            expect(response.status).toBe(301);
            expect(response.headers.get('location')).toBe('/.well-known/openapi.yaml');

            const spec = await request('/.well-known/openapi.yaml');
            expect(spec.status).toBe(200);
            expect(await spec.text()).toMatch(/^openapi: /m);
        });
    });

    describe('blog list', () => {
        test('GET /api/v1/blog returns posts with default pagination', async () => {
            const { response, body } = await getJson('/blog');
            expect(response.headers.get('x-ratelimit-limit')).toBe('60');
            expect(response.headers.get('vary')).toContain('Accept');
            expect(Array.isArray(body.data)).toBe(true);
            expect(body.pagination).toEqual({
                page: 1,
                limit: 20,
                total: body.total,
                totalPages: Math.max(1, Math.ceil(body.total / 20)),
                hasNextPage: body.total > 20,
                hasPrevPage: false
            });
            for (const item of body.data) {
                expect(item).toContainAllKeys([
                    'id',
                    'title',
                    'slug',
                    'excerpt',
                    'summary',
                    'tldr',
                    'collaborators',
                    'created_at',
                    'updated_at'
                ]);
            }
        });

        test('GET /api/v1/blog?q= matches title or excerpt', async () => {
            const { body } = await getJson('/blog?q=api');
            for (const item of body.data) {
                expect(`${item.title} ${item.excerpt ?? ''}`.toLowerCase()).toContain('api');
            }
        });

        test.skipIf(!post)('GET /api/v1/blog?id= filters by ID', async () => {
            const { body } = await getJson(`/blog?id=${post!.id}`);
            expect(body.data.map((item: any) => item.id)).toEqual([post!.id]);
        });

        test.skipIf(!post)('GET /api/v1/blog?slug= filters by slug', async () => {
            const { body } = await getJson(`/blog?slug=${encodeURIComponent(post!.slug)}`);
            expect(body.data.map((item: any) => item.slug)).toEqual([post!.slug]);
        });

        test('GET /api/v1/blog?page=1&limit=2 paginates', async () => {
            const { body } = await getJson('/blog?page=1&limit=2');
            expect(body.pagination.limit).toBe(2);
            expect(body.data.length).toBeLessThanOrEqual(2);
        });

        test('GET /api/v1/blog clamps limit to 100', async () => {
            const { body } = await getJson('/blog?limit=1000');
            expect(body.pagination.limit).toBe(100);
        });

        test('GET /api/v1/blog?format=md returns the markdown catalog', async () => {
            expect(await getText('/blog?format=md', 'text/markdown')).toStartWith(
                '# Posts Catalog'
            );
        });

        test('GET /api/v1/blog with Accept: text/markdown returns markdown', async () => {
            const body = await getText('/blog', 'text/markdown', {
                headers: { Accept: 'text/markdown' }
            });
            expect(body).toStartWith('# Posts Catalog');
        });
    });

    describe.skipIf(!post)('single post', () => {
        test('GET /api/v1/blog/{slug} returns the post with content and counts', async () => {
            const { body } = await getJson(`/blog/${encodeURIComponent(post!.slug)}`);
            expect(body).toMatchObject({ id: post!.id, slug: post!.slug, published: true });
            expect(typeof body.content).toBe('string');
            expect(Number.isInteger(body.comment_count)).toBe(true);
            expect(Number.isInteger(body.views_count)).toBe(true);
            expect(Array.isArray(body.tldr)).toBe(true);
            expect(Array.isArray(body.collaborators)).toBe(true);
        });

        test('GET /api/v1/blog/{id} resolves the same post by UUID', async () => {
            const { body } = await getJson(`/blog/${post!.id}`);
            expect(body.slug).toBe(post!.slug);
        });

        test('GET /api/v1/blog/{slug}?format=md returns markdown', async () => {
            const body = await getText(
                `/blog/${encodeURIComponent(post!.slug)}?format=md`,
                'text/markdown'
            );
            expect(body).toStartWith(`# ${post!.title}`);
            expect(body).toContain(`- **Slug**: \`${post!.slug}\``);
        });

        test('GET /api/v1/blog/{slug}?format=text returns plain text', async () => {
            const body = await getText(
                `/blog/${encodeURIComponent(post!.slug)}?format=text`,
                'text/plain'
            );
            expect(body).toStartWith(`${post!.title}\n\nID: ${post!.id}\nSlug: ${post!.slug}\n`);
        });
    });

    test('GET /api/v1/blog/{unknown-slug} returns BLOG_POST_NOT_FOUND', async () => {
        const error = await expectApiError(
            '/blog/this-slug-does-not-exist-12345',
            404,
            'BLOG_POST_NOT_FOUND'
        );
        expect(error.details).toBe(
            "No blog post exists with slug 'this-slug-does-not-exist-12345'."
        );
    });

    describe('comments', () => {
        const fields = [
            'id',
            'post_id',
            'parent_id',
            'author_name',
            'content',
            'is_anonymous',
            'is_admin',
            'is_approved',
            'created_at'
        ];

        test('GET /api/v1/blog/comments returns recent approved comments, newest first', async () => {
            const { body } = await getJson('/blog/comments');
            expect(Object.keys(body)).toEqual(['data']);
            for (const comment of body.data) {
                expect(comment).toContainAllKeys(fields);
                expect(comment.is_approved).toBe(true);
            }
            const times = body.data.map((comment: any) => Date.parse(comment.created_at));
            expect(times).toEqual([...times].sort((a, b) => b - a));
        });

        test.skipIf(!post)(
            'GET /api/v1/blog/comments?postId= returns one thread, oldest first',
            async () => {
                const { body } = await getJson(`/blog/comments?postId=${post!.id}`);
                for (const comment of body.data) expect(comment.post_id).toBe(post!.id);
                const times = body.data.map((comment: any) => Date.parse(comment.created_at));
                expect(times).toEqual([...times].sort((a, b) => a - b));

                const alias = await getJson(`/blog/comments?post_id=${post!.id}`);
                expect(alias.body).toEqual(body);
            }
        );

        test('GET /api/v1/blog/comments?postId=not-a-uuid is rejected', async () => {
            await expectApiError(
                '/blog/comments?postId=not-a-uuid',
                400,
                'BLOG_COMMENT_INVALID_POST_ID'
            );
        });
    });

    describe('views', () => {
        test.skipIf(!post)('GET /api/v1/blog/views?postId= returns the view count', async () => {
            const { body } = await getJson(`/blog/views?postId=${post!.id}`);
            expect(body.postId).toBe(post!.id);
            expect(Number.isInteger(body.views)).toBe(true);
        });

        test('GET /api/v1/blog/views without postId is rejected', async () => {
            await expectApiError('/blog/views', 400, 'BLOG_VIEW_POST_ID_REQUIRED');
        });

        test('GET /api/v1/blog/views?postId=not-a-uuid is rejected', async () => {
            await expectApiError('/blog/views?postId=not-a-uuid', 400, 'BLOG_VIEW_INVALID_POST_ID');
        });
    });

    describe('author', () => {
        test('GET /api/v1/author returns the combined profile', async () => {
            const { body } = await getJson('/author');
            expect(Object.keys(body).sort()).toEqual(
                ['contact', 'cv', 'funding', 'profile', 'skills', 'socials'].sort()
            );
            expect(typeof body.profile.name).toBe('string');
        });

        test('GET /api/v1/author?fields= returns only the requested sections', async () => {
            const { body } = await getJson('/author?fields=profile,skills');
            expect(Object.keys(body).sort()).toEqual(['profile', 'skills']);
        });

        test('GET /api/v1/author?profile accepts a bare flag', async () => {
            const { body } = await getJson('/author?profile');
            expect(Object.keys(body)).toEqual(['profile']);
        });

        test('GET /api/v1/author?sponsorship is an alias for funding', async () => {
            const { body } = await getJson('/author?sponsorship');
            expect(Object.keys(body)).toEqual(['funding']);
        });

        test('GET /api/v1/author?format=md returns markdown', async () => {
            expect((await getText('/author?format=md', 'text/markdown')).trim()).not.toBe('');
        });

        for (const section of ['contact', 'socials', 'skills', 'funding', 'cv']) {
            test(`GET /api/v1/author/${section} returns JSON`, async () => {
                const { body } = await getJson(`/author/${section}`);
                expect(body).not.toBeNull();
            });
        }
    });

    describe('cv', () => {
        async function headCv(query = '') {
            const response = await api(`/cv${query}`, { method: 'HEAD' });
            if (response.status === 404) return null;
            expect(response.status).toBe(200);
            return response;
        }

        test('HEAD /api/v1/cv serves the PDF inline with a checksum header', async () => {
            const response = await headCv();
            if (!response) {
                await expectApiError('/cv', 404, 'CV_DOCUMENT_NOT_FOUND');
                return;
            }
            expect(response.headers.get('content-type')).toBe('application/pdf');
            expect(response.headers.get('content-disposition')).toMatch(/^inline; filename=".+"$/);
            expect(response.headers.get('x-checksum-sha256')).toMatch(SHA256_RE);
        });

        test('HEAD /api/v1/cv?download=1 forces an attachment', async () => {
            const response = await headCv('?download=1');
            if (!response) return;
            expect(response.headers.get('content-disposition')).toMatch(
                /^attachment; filename=".+"$/
            );
        });

        test('GET /api/v1/cv?format=sha256 returns the checksum sidecar', async () => {
            const response = await api('/cv?format=sha256');
            if (response.status === 404) return;
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toContain('text/plain');
            const checksum = response.headers.get('x-checksum-sha256')!;
            expect(checksum).toMatch(SHA256_RE);
            expect(await response.text()).toMatch(new RegExp(`^${checksum}  .+\\.pdf\\n$`));

            const alias = await api('/cv?checksum=1');
            expect(alias.headers.get('x-checksum-sha256')).toBe(checksum);
        });
    });

    describe('search', () => {
        test('GET /api/v1/search?q= returns post results', async () => {
            const { body } = await getJson('/search?q=blog');
            expect(body.query).toBe('blog');
            expect(body.pagination).toEqual({
                limit: 6,
                offset: 0,
                returned: body.data.length,
                hasMore: body.pagination.hasMore
            });
            expect(typeof body.pagination.hasMore).toBe('boolean');
            for (const result of body.data) {
                expect(result.type).toBe('post');
                expect(result.url).toStartWith('/blog/');
            }
        });

        test('GET /api/v1/search?q=a returns an empty result, not a 400', async () => {
            const { body } = await getJson('/search?q=a');
            expect(body).toEqual({
                query: 'a',
                data: [],
                pagination: { limit: 6, offset: 0, returned: 0, hasMore: false }
            });
        });

        test('GET /api/v1/search?limit=2&offset=1 pages the results', async () => {
            const { body } = await getJson('/search?q=blog&limit=2&offset=1');
            expect(body.pagination.limit).toBe(2);
            expect(body.pagination.offset).toBe(1);
            expect(body.data.length).toBeLessThanOrEqual(2);
        });

        test('GET /api/v1/search?offset=-1 is rejected', async () => {
            await expectApiError('/search?q=blog&offset=-1', 400, 'SEARCH_INVALID_OFFSET');
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
