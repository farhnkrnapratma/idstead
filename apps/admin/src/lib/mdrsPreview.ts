import { DefineError, renderMarkdown } from '@mdrs/core';
import { createMdrsResolvers } from '#lib/mdrsResolvers.ts';
import { adminFetch } from './adminClient';
import * as publicEnv from '$app/env/public';
import { siteRenderOptions } from '#lib/mdrsOptions.ts';

type MdrsScope = 'author' | 'blog' | 'post' | 'analytics';

const ENDPOINT = '/api/internal/admin/mdrs-data';
const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; value: Promise<unknown> }>();

async function request(scope: MdrsScope, slug?: string): Promise<unknown> {
    const response = await adminFetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, slug })
    }).catch(() => null);
    const body = (await response?.json().catch(() => null)) as {
        data?: unknown;
        error?: { message?: string };
    } | null;
    if (!response?.ok)
        throw new DefineError(body?.error?.message ?? 'Live data is unavailable right now.');
    return body?.data;
}

function cached(scope: MdrsScope, slug?: string): Promise<unknown> {
    const key = `${scope}:${slug ?? ''}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
    const value = request(scope, slug);
    cache.set(key, { at: Date.now(), value });
    value.catch(() => cache.delete(key));
    return value;
}

export function renderMdrsPreview(markdown: string): Promise<string> {
    return renderMarkdown(
        markdown,
        createMdrsResolvers({
            author: () => cached('author'),
            blogList: () => cached('blog'),
            blogPost: slug => cached('post', slug),
            analytics: () => cached('analytics')
        }),
        siteRenderOptions(publicEnv.PUBLIC_SITE_URL)
    );
}
