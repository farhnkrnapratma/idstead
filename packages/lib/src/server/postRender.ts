// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import {
    RENDER_VERSION,
    prepareMarkdownPage,
    usesLiveData,
    type ApiRegistry,
    type HeadingItem,
    type RenderOptions
} from '@mdrs/core';
import type { PostRenderStore } from '@idstead/data';
import { estimateReadTime } from '@idstead/domain/readTime.ts';

export { postRenderPath } from '@idstead/data';

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
    resolvers: ApiRegistry,
    options: RenderOptions = {}
): Promise<PostRender> {
    const { html, headings } = await prepareMarkdownPage(markdown, resolvers, options);
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

export interface RenderRefreshResult {
    checked: number;
    rendered: number;
    failed: number;
}

export const RENDER_REFRESH_MAX_POSTS = 20;
export const RENDER_REFRESH_MAX_RENDERS = 5;

export async function refreshPostRenders(
    store: PostRenderStore,
    resolvers: ApiRegistry,
    options: RenderOptions = {},
    maxRenders = RENDER_REFRESH_MAX_RENDERS
): Promise<RenderRefreshResult> {
    const result: RenderRefreshResult = { checked: 0, rendered: 0, failed: 0 };
    const sources = await store.listRenderCandidates(RENDER_REFRESH_MAX_POSTS);
    for (const source of sources) {
        if (result.rendered + result.failed >= maxRenders) break;
        result.checked++;
        const stored = await store.downloadRender(source);
        const current = stored === null ? null : parsePostRender(stored);
        if (current && !current.live) continue;
        try {
            const markdown = await store.downloadMarkdown(source);
            if (markdown === null) throw new Error('Markdown file is missing.');
            await store.writeRender(
                source,
                JSON.stringify(await buildPostRender(markdown, resolvers, options))
            );
            result.rendered++;
        } catch (error) {
            console.error('Post render refresh failed:', store.renderPath(source), error);
            result.failed++;
        }
    }
    return result;
}
