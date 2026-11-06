// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, test } from 'bun:test';
import { more, slot } from './support.ts';

const EMAIL = 'ada@example.com';
const SHA = createHash('sha256').update(EMAIL).digest('hex');
const MD5 = createHash('md5').update(EMAIL).digest('hex');

const state = {
    profile: { name: 'Ada', username: 'ada', email: EMAIL, avatarVersion: 'v1' } as Record<
        string,
        unknown
    > | null,
    profileError: false,
    contact: [{ href: `mailto:${EMAIL}` }] as unknown[],
    contactError: false,
    socialLinks: [{ label: 'x' }] as unknown[],
    socialError: false,
    pages: [{ slug: 'terms', title: 'Terms', content: 'x' }] as unknown[],
    pagesError: false,
    analytics: { provider: 'ga4', measurementId: 'G-ABC123XYZ' } as unknown,
    analyticsError: false,
    rules: { excluded: ['Hidden'], pinned: ['shown'] },
    rulesError: false,
    source: 'https://github.com/ada/site' as string | undefined,
    asset: { ok: true, status: 200, headers: { etag: '"a"' }, body: 'png' } as Record<string, any>,
    served: [] as string[],
    repos: [] as unknown[]
};

slot.workerBinding = async () => state.source;
more.serveIdentityAsset = (async (_request: Request, url: URL) => {
    state.served.push(url.pathname);
    return state.asset;
}) as unknown as typeof more.serveIdentityAsset;

const layout = await import('../../apps/web/src/routes/+layout.server.ts');
const avatar = await import('../../apps/web/src/routes/avatar/[hash]/+server.ts');

function repo(name: string, extra: Record<string, unknown> = {}) {
    return {
        name,
        full_name: `ada/${name}`,
        description: null,
        html_url: `https://github.com/ada/${name}`,
        clone_url: '',
        ssh_url: '',
        default_branch: 'main',
        language: 'TypeScript',
        stargazers_count: 1,
        forks_count: 0,
        created_at: null,
        pushed_at: null,
        topics: [],
        fork: false,
        archived: false,
        private: false,
        license: null,
        ...extra
    };
}

beforeEach(() => {
    state.profile = { name: 'Ada', username: 'ada', email: EMAIL, avatarVersion: 'v1' };
    state.profileError = false;
    state.contact = [{ href: `mailto:${EMAIL}` }];
    state.contactError = false;
    state.socialError = false;
    state.pagesError = false;
    state.analyticsError = false;
    state.rulesError = false;
    state.source = 'https://github.com/ada/site';
    state.asset = { ok: true, status: 200, headers: { etag: '"a"' }, body: 'png' };
    state.served = [];
    state.repos = [repo('Hidden'), repo('shown')];
    slot.publicRepositories = () => ({
        author: {
            profile: async () => {
                if (state.profileError) throw new Error('db');
                return state.profile;
            },
            contactLinks: async () => {
                if (state.contactError) throw new Error('db');
                return state.contact;
            },
            socialLinks: async () => {
                if (state.socialError) throw new Error('db');
                return state.socialLinks;
            },
            projectRepoRules: async () => {
                if (state.rulesError) throw new Error('db');
                return state.rules;
            }
        },
        legal: {
            pages: async () => {
                if (state.pagesError) throw new Error('db');
                return state.pages;
            }
        },
        site: {
            analytics: async () => {
                if (state.analyticsError) throw new Error('db');
                return state.analytics;
            },
            contentLicense: async () => ({ license: 'CC0-1.0' })
        }
    });
});

function fetchOf(repos: () => unknown[]) {
    return (async (input: unknown) =>
        String(input).includes('/user/repos') ?
            Response.json(repos())
        :   new Response('{}', { status: 500 })) as unknown as typeof fetch;
}

describe('layout load', () => {
    const { load } = layout as any;
    const run = (platform: unknown = {}, fetch: typeof globalThis.fetch = fetchOf(() => [])) => {
        const headers: Array<Record<string, string>> = [];
        const result = load({
            fetch,
            platform,
            setHeaders: (value: Record<string, string>) => void headers.push(value)
        });
        return Promise.resolve(result).then(data => ({ data, headers }));
    };

    test('combines the profile, links, legal pages and flags', async () => {
        const { data, headers } = await run({
            env: { RESEND_API_KEY: 'key', SUBSCRIBER_FROM_EMAIL: 'from@example.com' }
        });
        expect(data.author).toMatchObject({ name: 'Ada', socialLinks: state.socialLinks });
        expect(data.legalPages).toEqual(['terms']);
        expect(data.newsletterEnabled).toBe(true);
        expect(data.cookieConsent).toBe(true);
        expect(data.sourceUrl).toBe('https://github.com/ada/site');
        expect(data.pinnedRepoNames).toEqual(['shown']);
        expect(data.contentLicense).toBeDefined();
        expect(headers[0]['cache-control']).toContain('s-maxage=60');
    });

    test('falls back when every source fails', async () => {
        state.profileError = true;
        state.socialError = true;
        state.pagesError = true;
        state.analyticsError = true;
        state.rulesError = true;
        state.source = undefined;
        const { data } = await run();
        expect(data.author).toBeNull();
        expect(data.legalPages).toEqual([]);
        expect(data.pinnedRepoNames).toEqual([]);
        expect(data.newsletterEnabled).toBe(false);
        expect(data.cookieConsent).toBe(false);
        expect(data.sourceUrl).toBeNull();
    });

    test('survives response headers that are already sent', async () => {
        const data = await load({
            fetch: fetchOf(() => []),
            platform: {},
            setHeaders: () => {
                throw new Error('sent');
            }
        });
        expect(data.projects).toEqual([]);
    });

    test('lists GitHub projects without the excluded ones and uses the edge cache', async () => {
        const store = new Map<string, Response>();
        const puts: string[] = [];
        (globalThis as any).caches = {
            default: {
                match: async (key: string) => store.get(key)?.clone(),
                put: async (key: string, response: Response) => {
                    puts.push(key);
                    store.set(key, response);
                }
            }
        };
        try {
            const platform = { env: { GITHUB_PAT: 'token', PUBLIC_SITE_URL: 'https://ada.test' } };
            const first = await run(
                platform,
                fetchOf(() => state.repos)
            );
            expect(first.data.projects.map((project: any) => project.name)).toEqual(['shown']);
            expect(puts).toEqual(['https://projects-cache.ada.test/github/repos']);
            const second = await run(
                platform,
                fetchOf(() => [])
            );
            expect(second.data.projects.map((project: any) => project.name)).toEqual(['shown']);

            store.set(puts[0], new Response('{"not":"a list"}'));
            const third = await run(
                platform,
                fetchOf(() => state.repos)
            );
            expect(third.data.projects.length).toBeGreaterThan(0);
            store.set(puts[0], new Response('not json'));
            await run(
                platform,
                fetchOf(() => [])
            );
            (globalThis as any).caches.default.match = async () => {
                throw new Error('cache');
            };
            await run(
                { env: { GITHUB_PAT: 'token' } },
                fetchOf(() => [])
            );
            (globalThis as any).caches.default.put = async () => {
                throw new Error('cache');
            };
            await run(
                platform,
                fetchOf(() => [])
            );
        } finally {
            delete (globalThis as any).caches;
        }
    });
});

describe('GET /avatar/[hash]', () => {
    const { GET } = avatar as any;
    const get = (hash: string, query = '') =>
        GET({
            request: new Request(`https://ada.test/avatar/${hash}${query}`),
            params: { hash },
            url: new URL(`https://ada.test/avatar/${hash}${query}`),
            platform: {}
        }) as Promise<Response>;

    test('serves the avatar for a matching hash', async () => {
        const response = await get(SHA, '?s=190');
        expect(response.status).toBe(200);
        expect(response.headers.get('access-control-allow-origin')).toBe('*');
        expect(response.headers.get('cache-control')).toBe('public, max-age=300');
        expect(response.headers.get('etag')).toBe('"a"');
        expect(state.served).toEqual(['/android-chrome-192x192.png']);
        expect((await get(MD5)).status).toBe(200);
    });

    test('returns 404 for unknown hashes, missing avatars and missing assets', async () => {
        expect((await get('0'.repeat(64))).status).toBe(404);
        expect((await get('not-a-hash')).status).toBe(404);
        state.profile = { ...state.profile, avatarVersion: null };
        expect((await get(SHA)).status).toBe(404);
        state.profile = null;
        expect((await get(SHA)).status).toBe(404);
        state.profile = { email: EMAIL, avatarVersion: 'v1' };
        state.contact = [];
        expect((await get(SHA)).status).toBe(404);
        state.contact = [{ href: `mailto:${EMAIL}` }];
        state.asset = { ok: false };
        const missing = await get(SHA);
        expect(missing.status).toBe(404);
        expect(missing.headers.get('cache-control')).toBe('public, max-age=300');
    });

    test('fails closed when the profile cannot be read', async () => {
        state.profileError = true;
        const response = await get(SHA);
        expect(response.status).toBe(503);
        expect(response.headers.get('cache-control')).toBe('no-store');
        state.profileError = false;
        state.contactError = true;
        expect((await get(SHA)).status).toBe(503);
    });
});
