import type { Handle } from '@sveltejs/kit/hooks';
import { version } from '$app/env';
import { runInBackground } from './workerEnv';

export const PAGE_DATA_CACHE_SECONDS = 60;

const CACHEABLE_PAGES = new Set(['/', '/projects', '/blog', '/resume', '/funding', '/contact']);
const DATA_SUFFIX = '/__data.json';
const TRACKING_PARAM = /^(_gl|_ga|gclid|fbclid|msclkid|utm_[a-z_]+)$/i;

interface EdgeCache {
    match(key: string): Promise<Response | undefined>;
    put(key: string, response: Response): Promise<void>;
}

function edgeCache(): EdgeCache | undefined {
    return (globalThis as { caches?: { default?: EdgeCache } }).caches?.default;
}

export function pageDataCacheKey(url: URL, appVersion: string = version): string | null {
    if (!url.pathname.endsWith(DATA_SUFFIX)) return null;
    const page = url.pathname.slice(0, -DATA_SUFFIX.length) || '/';
    if (!CACHEABLE_PAGES.has(page)) return null;
    const key = new URL(
        `https://page-data-cache.${url.hostname}/${encodeURIComponent(appVersion)}${url.pathname}`
    );
    const params = [...url.searchParams]
        .filter(([name]) => !TRACKING_PARAM.test(name))
        .sort(([a], [b]) => a.localeCompare(b));
    for (const [name, value] of params) key.searchParams.append(name, value);
    return key.toString();
}

export const pageDataCache: Handle = async ({ event, resolve }) => {
    const key =
        event.request.method === 'GET' && event.isDataRequest ?
            pageDataCacheKey(new URL(event.request.url))
        :   null;
    const cache = key ? edgeCache() : undefined;
    if (!key || !cache) return resolve(event);

    const hit = await cache.match(key).catch(() => undefined);
    if (hit) {
        const response = new Response(hit.body, hit);
        response.headers.set('X-Page-Data-Cache', 'HIT');
        return response;
    }

    const response = await resolve(event);
    if (response.status === 200 && !response.headers.has('set-cookie')) {
        const stored = new Response(response.clone().body, response);
        stored.headers.set(
            'Cache-Control',
            `public, max-age=0, s-maxage=${PAGE_DATA_CACHE_SECONDS}`
        );
        await runInBackground(cache.put(key, stored).catch(() => {}));
    }
    return response;
};
