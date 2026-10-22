import type { AuthorRepository } from '../author';
import type { BlogRepository, CommentRepository, PostSource } from '../blog';
import type { Repositories } from '../index';
import type { LegalPageRepository } from '../legal';
import { postRenderPath } from '../supabase/paths';
import { createPostSource, isPostSource, sourceRecord } from '../source';
import type { D1Like } from '../d1/client';

export const CACHE_TTL_SECONDS = 24 * 60 * 60;
export const STATS_TTL_SECONDS = 60;
export const RENDER_TTL_SECONDS = 5 * 60;

export interface CacheGenerations {
    current(domain: string): Promise<number>;
}

export interface ResultCache {
    get(key: string): Promise<unknown | undefined>;
    put(key: string, value: unknown, ttlSeconds: number): Promise<void>;
}

export interface CachedRepositoryOptions {
    generations: CacheGenerations;
    cache: ResultCache;
    namespace: () => Promise<string>;
}

const SOURCE_KEY = '$postSource';

export function encodeCached(value: unknown): unknown {
    if (isPostSource(value)) return { [SOURCE_KEY]: sourceRecord(value) };
    if (Array.isArray(value)) return value.map(encodeCached);
    if (value && typeof value === 'object')
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, encodeCached(item)])
        );
    return value;
}

export function decodeCached(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(decodeCached);
    if (value && typeof value === 'object') {
        const record = (value as Record<string, unknown>)[SOURCE_KEY];
        if (record && typeof record === 'object')
            return createPostSource(record as { postId: string; storagePath: string | null });
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, decodeCached(item)])
        );
    }
    return value;
}

function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object')
        return Object.fromEntries(
            Object.keys(value)
                .filter(key => (value as Record<string, unknown>)[key] !== undefined)
                .sort()
                .map(key => [key, canonical((value as Record<string, unknown>)[key])])
        );
    return value;
}

export function cacheKey(
    namespace: string,
    scope: string,
    method: string,
    args: unknown[]
): string {
    const query = encodeURIComponent(JSON.stringify(canonical(args)));
    return `https://data-cache.idstead.invalid/${encodeURIComponent(namespace)}/${encodeURIComponent(scope)}/${method}?a=${query}`;
}

export function createD1CacheGenerations(db: D1Like): CacheGenerations {
    return {
        async current(domain: string) {
            const row = await db
                .prepare('SELECT gen FROM db_cache_generations WHERE domain = ?1')
                .bind(domain)
                .first<{ gen: number }>();
            return Number(row?.gen ?? 0);
        }
    };
}

export function memoryResultCache(
    now: () => number = Date.now
): ResultCache & { entries: Map<string, unknown> } {
    const entries = new Map<string, unknown>();
    const expiry = new Map<string, number>();
    return {
        entries,
        async get(key) {
            if (!entries.has(key)) return undefined;
            if ((expiry.get(key) ?? 0) <= now()) {
                entries.delete(key);
                return undefined;
            }
            return structuredClone(entries.get(key));
        },
        async put(key, value, ttlSeconds) {
            entries.set(key, structuredClone(value));
            expiry.set(key, now() + ttlSeconds * 1000);
        }
    };
}

export function cachedRepositories(
    repos: Repositories,
    options: CachedRepositoryOptions
): Repositories {
    async function remember<T>(
        scope: () => Promise<string>,
        method: string,
        args: unknown[],
        ttlSeconds: number,
        load: () => Promise<T>,
        keep: (value: T) => boolean = () => true
    ): Promise<T> {
        let key: string | null = null;
        try {
            key = cacheKey(await options.namespace(), await scope(), method, args);
            const hit = await options.cache.get(key);
            if (hit !== undefined) return decodeCached(hit) as T;
        } catch {}
        const value = await load();
        if (key && keep(value))
            await options.cache.put(key, encodeCached(value), ttlSeconds).catch(() => {});
        return value;
    }

    const domain = (name: string) => async () =>
        `${name}@${await options.generations.current(name)}`;
    const path = (storagePath: string | null) => async () => `content:${storagePath ?? ''}`;

    const author: AuthorRepository = {
        profile: settings =>
            remember(domain('author'), 'author.profile', [settings ?? {}], CACHE_TTL_SECONDS, () =>
                repos.author.profile(settings)
            ),
        socialLinks: () =>
            remember(domain('author'), 'author.socialLinks', [], CACHE_TTL_SECONDS, () =>
                repos.author.socialLinks()
            ),
        fundingLinks: () =>
            remember(domain('author'), 'author.fundingLinks', [], CACHE_TTL_SECONDS, () =>
                repos.author.fundingLinks()
            ),
        contactLinks: () =>
            remember(domain('author'), 'author.contactLinks', [], CACHE_TTL_SECONDS, () =>
                repos.author.contactLinks()
            ),
        cvEntries: () =>
            remember(domain('author'), 'author.cvEntries', [], CACHE_TTL_SECONDS, () =>
                repos.author.cvEntries()
            ),
        skillGroups: () =>
            remember(domain('author'), 'author.skillGroups', [], CACHE_TTL_SECONDS, () =>
                repos.author.skillGroups()
            ),
        projectRepoRules: () =>
            remember(domain('author'), 'author.projectRepoRules', [], CACHE_TTL_SECONDS, () =>
                repos.author.projectRepoRules()
            ),
        activeCvDocument: () =>
            remember(domain('author'), 'author.activeCvDocument', [], CACHE_TTL_SECONDS, () =>
                repos.author.activeCvDocument()
            ),
        activeOpenPgpKey: () =>
            remember(domain('author'), 'author.activeOpenPgpKey', [], CACHE_TTL_SECONDS, () =>
                repos.author.activeOpenPgpKey()
            ),
        siteUrl: () =>
            remember(domain('author'), 'author.siteUrl', [], CACHE_TTL_SECONDS, () =>
                repos.author.siteUrl()
            )
    };

    const blog: BlogRepository = {
        listPublished: listOptions =>
            remember(
                domain('blog'),
                'blog.listPublished',
                [listOptions ?? {}],
                CACHE_TTL_SECONDS,
                () => repos.blog.listPublished(listOptions)
            ),
        listPublishedWithStats: listOptions =>
            remember(
                domain('blog'),
                'blog.listPublishedWithStats',
                [listOptions ?? {}],
                STATS_TTL_SECONDS,
                () => repos.blog.listPublishedWithStats(listOptions)
            ),
        findPublished: reference =>
            remember(domain('blog'), 'blog.findPublished', [reference], CACHE_TTL_SECONDS, () =>
                repos.blog.findPublished(reference)
            ),
        getPublishedBySlug: slug =>
            remember(domain('blog'), 'blog.getPublishedBySlug', [slug], CACHE_TTL_SECONDS, () =>
                repos.blog.getPublishedBySlug(slug)
            ),
        postStats: post => repos.blog.postStats(post),
        readMarkdown: (source: PostSource, readOptions) => {
            const { storagePath } = sourceRecord(source);
            return remember(
                path(storagePath),
                'blog.readMarkdown',
                [],
                CACHE_TTL_SECONDS,
                () => repos.blog.readMarkdown(source, readOptions),
                value => value !== null
            );
        },
        readRender: (source: PostSource, readOptions) => {
            const renderPath = postRenderPath(sourceRecord(source).storagePath);
            return remember(
                path(renderPath),
                'blog.readRender',
                [],
                RENDER_TTL_SECONDS,
                () => repos.blog.readRender(source, readOptions),
                value => value !== null
            );
        }
    };

    const comments: CommentRepository = {
        listApproved: post =>
            remember(
                domain(`comments:${sourceRecord(post.source).postId}`),
                'comments.listApproved',
                [],
                CACHE_TTL_SECONDS,
                () => repos.comments.listApproved(post)
            ),
        listRecentApproved: limit => repos.comments.listRecentApproved(limit)
    };

    const legal: LegalPageRepository = {
        page: slug =>
            remember(domain('legal'), 'legal.page', [slug], CACHE_TTL_SECONDS, () =>
                repos.legal.page(slug)
            ),
        pages: () =>
            remember(domain('legal'), 'legal.pages', [], CACHE_TTL_SECONDS, () =>
                repos.legal.pages()
            )
    };

    return { author, blog, comments, legal };
}
