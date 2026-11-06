// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    cachedRepositories,
    createD1CacheGenerations,
    memoryResultCache
} from '../packages/data/src/cache/index.ts';
import { createPostSource, isPostSource } from '../packages/data/src/source.ts';
import { d1Shim } from './support/d1.ts';

type Calls = Record<string, number>;

function fakeRepositories(calls: Calls) {
    const group = (name: string, result: (method: string) => unknown) =>
        new Proxy(
            {},
            {
                get: (_, method: string) => async () => {
                    calls[`${name}.${method}`] = (calls[`${name}.${method}`] ?? 0) + 1;
                    return result(method);
                }
            }
        );
    const source = createPostSource({ postId: 'p1', storagePath: 'posts/p1/a.md' });
    return {
        author: group('author', () => ({ name: 'A' })),
        blog: group('blog', method =>
            method === 'readMarkdown' || method === 'readRender' ? null
            : method === 'findPublished' ? { id: 'p1', source }
            : [{ id: 'p1', source }]
        ),
        comments: group('comments', () => []),
        legal: group('legal', () => ({ slug: 'privacy' })),
        site: group('site', () => ({ provider: 'none' }))
    } as never;
}

function options(counter = { generation: 0 }) {
    return {
        generations: { current: async () => counter.generation },
        cache: memoryResultCache(),
        namespace: async () => 'v1'
    };
}

describe('cachedRepositories', () => {
    test('serves repeated reads from the cache and restores post sources', async () => {
        const calls: Calls = {};
        const repos = cachedRepositories(fakeRepositories(calls), options());
        const source = createPostSource({ postId: 'p1', storagePath: 'posts/p1/a.md' });
        const post = { source } as never;

        await repos.author.profile();
        await repos.author.profile();
        await repos.author.socialLinks();
        await repos.author.socialLinks();
        expect(calls['author.profile']).toBe(1);
        expect(calls['author.socialLinks']).toBe(1);

        const found = await repos.blog.findPublished('p1');
        const again = await repos.blog.findPublished('p1');
        expect(calls['blog.findPublished']).toBe(1);
        expect(isPostSource((again as { source: unknown }).source)).toBe(true);
        expect(found).toBeTruthy();

        await repos.blog.listPublished();
        await repos.blog.listPublished();
        await repos.blog.listPublishedWithStats();
        await repos.blog.getPublishedBySlug('a');
        await repos.blog.getPublishedBySlug('a');
        await repos.blog.postStats(post);
        await repos.blog.readMarkdown(source);
        await repos.blog.readMarkdown(source);
        await repos.blog.readRender(source);
        expect(calls['blog.readMarkdown']).toBe(2);
        await repos.comments.listApproved(post);
        await repos.comments.listApproved(post);
        await repos.comments.listRecentApproved(3);
        await repos.legal.page('privacy' as never);
        await repos.legal.page('privacy' as never);
        await repos.legal.pages();
        await repos.site.analytics();
        await repos.site.analytics();
        await repos.site.contentLicense();
        expect(calls['comments.listApproved']).toBe(1);
        expect(calls['legal.page']).toBe(1);
        expect(calls['site.analytics']).toBe(1);
    });

    test('reloads after the generation changes and tolerates cache failures', async () => {
        const calls: Calls = {};
        const counter = { generation: 0 };
        const repos = cachedRepositories(fakeRepositories(calls), options(counter));
        await repos.legal.pages();
        counter.generation = 1;
        await repos.legal.pages();
        expect(calls['legal.pages']).toBe(2);

        const broken = cachedRepositories(fakeRepositories(calls), {
            generations: { current: async () => Promise.reject(new Error('down')) },
            cache: {
                get: async () => Promise.reject(new Error('down')),
                put: async () => Promise.reject(new Error('down'))
            },
            namespace: async () => 'v1'
        });
        expect(await broken.legal.pages()).toEqual({ slug: 'privacy' } as never);
    });

    test('expires entries and reads generations from the database', async () => {
        let clock = 0;
        const cache = memoryResultCache(() => clock);
        await cache.put('k', { a: 1 }, 1);
        expect(await cache.get('k')).toEqual({ a: 1 });
        clock = 2000;
        expect(await cache.get('k')).toBeUndefined();
        expect(await cache.get('missing')).toBeUndefined();

        const shim = d1Shim();
        shim.sqlite.run("UPDATE db_cache_generations SET gen = 4 WHERE domain = 'site'");
        const generations = createD1CacheGenerations(shim.db);
        expect(await generations.current('site')).toBe(4);
        expect(await generations.current('none')).toBe(0);
    });
});
