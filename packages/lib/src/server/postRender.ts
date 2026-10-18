import {
    RENDER_VERSION,
    prepareMarkdownPage,
    usesLiveData,
    type ApiRegistry,
    type HeadingItem
} from '@fkp/mdrs';
import { estimateReadTime } from '#lib/readTime.ts';

export { postRenderPath } from './postRenderPath';

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
