import { describe, expect, test } from 'bun:test';
import {
    cacheKey,
    cachedRepositories,
    createD1CacheGenerations,
    memoryResultCache,
    type ResultCache
} from '../packages/data/src/cache/index.ts';
import { createD1AuthorRepository } from '../packages/data/src/d1/author.ts';
import { createD1BlogRepository, createD1CommentRepository } from '../packages/data/src/d1/blog.ts';
import { createD1LegalPageRepository } from '../packages/data/src/d1/legal.ts';
import {
    createD1SiteSettingsRepository,
    createD1SiteSettingsWriter
} from '../packages/data/src/d1/siteSettings.ts';
import type { Repositories } from '../packages/data/src/index.ts';
import { d1Shim, insertRows, memoryBucket } from './support/d1.ts';

function counted(repos: Repositories) {
    const calls: string[] = [];
    const wrap = <T extends object>(name: string, target: T): T =>
        new Proxy(target, {
            get(object, key) {
                const value = Reflect.get(object, key);
                return typeof value === 'function' ?
                        (...args: unknown[]) => {
                            calls.push(`${name}.${String(key)}`);
                            return value.apply(object, args);
                        }
                    :   value;
            }
        });
    return {
        calls,
        repos: {
            author: wrap('author', repos.author),
            blog: wrap('blog', repos.blog),
            comments: wrap('comments', repos.comments),
            legal: wrap('legal', repos.legal),
            site: wrap('site', repos.site)
        }
    };
}

function setup(cache: ResultCache = memoryResultCache()) {
    const { db, sqlite } = d1Shim();
    const bucket = memoryBucket({ 'content/posts/a/1.md': '# A' });
    insertRows(sqlite, 'db_posts', [
        {
            id: 'a',
            slug: 'a',
            title: 'A',
            excerpt: 'A',
            published: true,
            storage_path: 'posts/a/1.md'
        },
        {
            id: 'b',
            slug: 'b',
            title: 'B',
            excerpt: 'B',
            published: true,
            storage_path: 'posts/b/1.md'
        }
    ]);
    insertRows(sqlite, 'db_legals', [{ slug: 'terms', title: 'Terms', content: '# T' }]);
    const base: Repositories = {
        author: createD1AuthorRepository(db),
        blog: createD1BlogRepository(db, bucket),
        comments: createD1CommentRepository(db),
        legal: createD1LegalPageRepository(db),
        site: createD1SiteSettingsRepository(db)
    };
    const { calls, repos } = counted(base);
    const cached = cachedRepositories(repos, {
        generations: createD1CacheGenerations(db),
        cache,
        namespace: async () => 'version-1'
    });
    return { sqlite, db, calls, cached };
}

describe('generational read cache', () => {
    test('serves a repeated read from the cache and keeps post sources usable', async () => {
        const { calls, cached } = setup();
        const first = await cached.blog.getPublishedBySlug('a');
        const second = await cached.blog.getPublishedBySlug('a');
        expect(second).toEqual(first);
        expect(calls.filter(call => call === 'blog.getPublishedBySlug')).toHaveLength(1);
        expect(await cached.blog.readMarkdown(second!.source)).toBe('# A');
        expect(await cached.blog.readMarkdown(second!.source)).toBe('# A');
        expect(calls.filter(call => call === 'blog.readMarkdown')).toHaveLength(1);
    });

    test('reads again after a write bumps the generation of its domain', async () => {
        const { sqlite, calls, cached } = setup();
        expect((await cached.blog.listPublished()).total).toBe(2);
        await cached.legal.pages();
        sqlite.query("update db_posts set title = 'A2' where id = 'a'").run();
        expect((await cached.blog.listPublished()).posts.map(post => post.title)).toContain('A2');
        await cached.legal.pages();
        expect(calls.filter(call => call === 'blog.listPublished')).toHaveLength(2);
        expect(calls.filter(call => call === 'legal.pages')).toHaveLength(1);
    });

    test('caches site settings until they are saved again', async () => {
        const { db, calls, cached } = setup();
        expect(await cached.site.analytics()).toEqual({ provider: 'none' });
        expect(await cached.site.analytics()).toEqual({ provider: 'none' });
        await createD1SiteSettingsWriter(db).saveAnalytics({
            provider: 'ga4',
            measurementId: 'G-ABC123'
        });
        expect(await cached.site.analytics()).toEqual({
            provider: 'ga4',
            measurementId: 'G-ABC123'
        });
        expect(calls.filter(call => call === 'site.analytics')).toHaveLength(2);
    });

    test('keys arguments canonically and isolates comments per post', async () => {
        expect(cacheKey('v', 'blog@1', 'm', [{ limit: 2, offset: 0 }])).toBe(
            cacheKey('v', 'blog@1', 'm', [{ offset: 0, limit: 2, search: undefined }])
        );
        const { sqlite, calls, cached } = setup();
        const a = (await cached.blog.getPublishedBySlug('a'))!;
        const b = (await cached.blog.getPublishedBySlug('b'))!;
        await cached.comments.listApproved(a);
        await cached.comments.listApproved(b);
        insertRows(sqlite, 'db_comments', [
            { post_id: 'b', author_name: 'Ann', content: 'Hi', is_approved: true }
        ]);
        await cached.comments.listApproved(a);
        expect(await cached.comments.listApproved(b)).toHaveLength(1);
        expect(calls.filter(call => call === 'comments.listApproved')).toHaveLength(3);
    });

    test('never caches errors or post stats and falls through a failing cache', async () => {
        const failing: ResultCache = {
            get: async () => {
                throw new Error('cache down');
            },
            put: async () => {
                throw new Error('cache down');
            }
        };
        const { calls, cached } = setup(failing);
        expect((await cached.legal.page('terms'))?.title).toBe('Terms');
        expect((await cached.legal.page('terms'))?.title).toBe('Terms');
        expect(calls.filter(call => call === 'legal.page')).toHaveLength(2);
        const healthy = setup();
        const post = (await healthy.cached.blog.getPublishedBySlug('a'))!;
        await healthy.cached.blog.postStats(post);
        await healthy.cached.blog.postStats(post);
        expect(healthy.calls.filter(call => call === 'blog.postStats')).toHaveLength(2);
        healthy.sqlite.run('DROP TABLE db_legals');
        await expect(healthy.cached.legal.pages()).rejects.toThrow();
        await expect(healthy.cached.legal.pages()).rejects.toThrow();
        expect(healthy.calls.filter(call => call === 'legal.pages')).toHaveLength(2);
    });
});
