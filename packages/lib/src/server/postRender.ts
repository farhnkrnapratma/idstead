import {
    RENDER_VERSION,
    prepareMarkdownPage,
    usesLiveData,
    type ApiRegistry,
    type HeadingItem
} from '@fkp/mdrs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { estimateReadTime } from '#lib/readTime.ts';

import { postRenderPath } from './postRenderPath';

export { postRenderPath };

export interface PostRender {
    version: number;
    live: boolean;
    html: string;
    headings: HeadingItem[];
    readTime: string;
}

const MAX_RENDER_BYTES = 4_000_000;

export async function buildPostRender(
    markdown: string,
    resolvers: ApiRegistry
): Promise<PostRender> {
    const { html, headings } = await prepareMarkdownPage(markdown, resolvers);
    return {
        version: RENDER_VERSION,
        live: usesLiveData(markdown),
        html,
        headings,
        readTime: estimateReadTime(markdown)
    };
}

function isHeading(value: unknown): value is HeadingItem {
    if (!value || typeof value !== 'object') return false;
    const heading = value as Record<string, unknown>;
    return (
        typeof heading.id === 'string'
        && typeof heading.text === 'string'
        && typeof heading.level === 'number'
    );
}

export function parsePostRender(text: string): PostRender | null {
    if (text.length > MAX_RENDER_BYTES) return null;
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch {
        return null;
    }
    if (!value || typeof value !== 'object') return null;
    const render = value as Record<string, unknown>;
    if (
        render.version !== RENDER_VERSION
        || typeof render.live !== 'boolean'
        || typeof render.html !== 'string'
        || typeof render.readTime !== 'string'
        || !Array.isArray(render.headings)
        || !render.headings.every(isHeading)
    )
        return null;
    return {
        version: render.version,
        live: render.live,
        html: render.html,
        headings: render.headings,
        readTime: render.readTime
    };
}

export async function fetchPostRender(
    url: string,
    fetchFn: typeof fetch
): Promise<PostRender | null> {
    try {
        const response = await fetchFn(url, { signal: AbortSignal.timeout(3000) });
        if (!response.ok) return null;
        return parsePostRender(await response.text());
    } catch {
        return null;
    }
}

export interface RenderRefreshResult {
    checked: number;
    rendered: number;
    failed: number;
}

export const RENDER_REFRESH_MAX_POSTS = 20;
export const RENDER_REFRESH_MAX_RENDERS = 5;

async function readText(
    bucket: ReturnType<SupabaseClient['storage']['from']>,
    path: string
): Promise<string | null> {
    const { data, error } = await bucket.download(path);
    return error || !data ? null : data.text();
}

export async function refreshPostRenders(
    db: SupabaseClient,
    resolvers: ApiRegistry,
    maxRenders = RENDER_REFRESH_MAX_RENDERS
): Promise<RenderRefreshResult> {
    const result: RenderRefreshResult = { checked: 0, rendered: 0, failed: 0 };
    const { data: posts, error } = await db
        .from('db_posts')
        .select('storage_path')
        .eq('published', true)
        .order('created_at', { ascending: false })
        .limit(RENDER_REFRESH_MAX_POSTS);
    if (error) throw error;
    const bucket = db.storage.from('blog-posts');
    for (const post of posts ?? []) {
        if (result.rendered + result.failed >= maxRenders) break;
        const storagePath = (post as { storage_path: string | null }).storage_path;
        const renderPath = postRenderPath(storagePath);
        if (!renderPath || !storagePath) continue;
        result.checked++;
        const stored = await readText(bucket, renderPath);
        const current = stored === null ? null : parsePostRender(stored);
        if (current && !current.live) continue;
        try {
            const markdown = await readText(bucket, storagePath);
            if (markdown === null) throw new Error('Markdown file is missing.');
            const render = await buildPostRender(markdown, resolvers);
            const { error: uploadError } = await bucket.upload(
                renderPath,
                new Blob([JSON.stringify(render)], { type: 'application/json' }),
                { contentType: 'application/json', upsert: true }
            );
            if (uploadError) throw new Error(uploadError.message);
            result.rendered++;
        } catch (error) {
            console.error('Post render refresh failed:', renderPath, error);
            result.failed++;
        }
    }
    return result;
}
