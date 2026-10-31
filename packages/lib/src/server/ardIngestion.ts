// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { normalizeArdEntry, type ArdEntry } from '#lib/server/ard.ts';

const MAX_SOURCE_BYTES = 1_048_576;
const MAX_SOURCE_COUNT = 32;
const MAX_ENTRY_COUNT = 1000;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 5000;
const ARD_MANIFEST_PATH = '/.well-known/ard.json';

export type ArdFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface ArdSource {
    url: string;
    required: boolean;
    robots: boolean;
}

interface ArdDocument {
    text: string;
    contentType: string;
    url: string;
}

export interface ArdCrawlResult {
    entries: ArdEntry[];
    sources: string[];
    warnings: string[];
}

function siteOrigin(value: string): URL {
    const origin = new URL(value);
    if (
        origin.username
        || origin.password
        || origin.origin !== value
        || origin.protocol !== 'https:'
    )
        throw new Error('ARD ingestion requires a canonical HTTPS site origin.');
    return origin;
}

function sameOriginUrl(value: string, origin: URL): URL | undefined {
    try {
        const url = new URL(value, origin);
        if (
            url.origin !== origin.origin
            || url.username
            || url.password
            || url.protocol !== origin.protocol
        )
            return undefined;
        url.hash = '';
        return url;
    } catch {
        return undefined;
    }
}

async function readBoundedText(response: Response): Promise<string> {
    const contentLength = response.headers.get('content-length');
    if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_SOURCE_BYTES)
        throw new Error('ARD source exceeded the response size limit.');

    const reader = response.body?.getReader();
    if (!reader) return '';
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            byteLength += value.byteLength;
            if (byteLength > MAX_SOURCE_BYTES) {
                await reader.cancel();
                throw new Error('ARD source exceeded the response size limit.');
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }

    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return new TextDecoder().decode(bytes);
}

async function fetchSource(source: string, origin: URL, fetcher: ArdFetcher): Promise<ArdDocument> {
    let current = sameOriginUrl(source, origin);
    if (!current) throw new Error('ARD source is outside the configured origin.');

    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
        const response = await fetcher(current, {
            headers: {
                Accept: 'application/json, application/ld+json, text/html;q=0.9, text/plain;q=0.8'
            },
            redirect: 'manual',
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
        });
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            await response.body?.cancel();
            if (!location || redirects === MAX_REDIRECTS)
                throw new Error('ARD source redirect could not be followed.');
            const next = sameOriginUrl(location, origin);
            if (!next) throw new Error('ARD source redirect left the configured origin.');
            current = next;
            continue;
        }
        if (!response.ok) throw new Error(`ARD source returned HTTP ${response.status}.`);
        if (response.url) {
            const finalUrl = sameOriginUrl(response.url, origin);
            if (!finalUrl) throw new Error('ARD source response left the configured origin.');
            current = finalUrl;
        }
        return {
            text: await readBoundedText(response),
            contentType: response.headers.get('content-type')?.toLowerCase() ?? '',
            url: current.href
        };
    }

    throw new Error('ARD source redirect limit exceeded.');
}

function htmlAttribute(value: string): string {
    return value
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>');
}

function parseAttributes(tag: string): Map<string, string> {
    const attributes = new Map<string, string>();
    const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    for (const match of tag.matchAll(pattern)) {
        const name = match[1].toLowerCase();
        const value = match[2] ?? match[3] ?? match[4] ?? '';
        attributes.set(name, htmlAttribute(value));
    }
    return attributes;
}

function jsonNodes(value: unknown): unknown[] {
    if (Array.isArray(value)) return value.flatMap(jsonNodes);
    if (typeof value !== 'object' || value === null) return [];
    const record = value as Record<string, unknown>;
    const nodes: unknown[] = [];
    if (Array.isArray(record.entries)) nodes.push(...record.entries);
    if (Array.isArray(record['@graph'])) nodes.push(...record['@graph']);
    if (Array.isArray(record['@included'])) nodes.push(...record['@included']);
    if (
        !Array.isArray(record.entries)
        && !Array.isArray(record['@graph'])
        && !Array.isArray(record['@included'])
    )
        nodes.push(record);
    return nodes;
}

function parseRobots(text: string): string[] {
    return Array.from(text.matchAll(/^\s*Agentmap\s*:\s*(\S+)\s*$/gim), match => match[1]);
}

function parseHtml(text: string): { entryNodes: unknown[]; sources: string[]; warnings: string[] } {
    const entryNodes: unknown[] = [];
    const sources: string[] = [];
    const warnings: string[] = [];

    for (const match of text.matchAll(/<link\b[^>]*>/gi)) {
        const attributes = parseAttributes(match[0]);
        const rel = attributes.get('rel')?.toLowerCase().split(/\s+/) ?? [];
        const href = attributes.get('href');
        if (rel.includes('ard') && href) sources.push(href);
    }

    for (const match of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
        const attributes = parseAttributes(match[1]);
        const mediaType = attributes.get('type')?.split(';', 1)[0].trim();
        if (mediaType !== 'application/ld+json') continue;
        try {
            entryNodes.push(...jsonNodes(JSON.parse(match[2].trim())));
        } catch {
            warnings.push('A page contained invalid application/ld+json markup.');
        }
    }

    return { entryNodes, sources, warnings };
}

function parseDocument(
    document: ArdDocument,
    source: ArdSource
): { entryNodes: unknown[]; sources: string[]; warnings: string[] } {
    if (source.robots) return { entryNodes: [], sources: parseRobots(document.text), warnings: [] };

    if (
        document.contentType.includes('text/html')
        || /^\s*(?:<!doctype\s+html|<html\b)/i.test(document.text)
    )
        return parseHtml(document.text);

    try {
        return { entryNodes: jsonNodes(JSON.parse(document.text)), sources: [], warnings: [] };
    } catch {
        return { entryNodes: [], sources: [], warnings: [] };
    }
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message.slice(0, 240) : 'Fetch failed.';
}

export async function crawlArdSources(
    siteUrl: string,
    fetcher: ArdFetcher = fetch
): Promise<ArdCrawlResult> {
    const origin = siteOrigin(siteUrl);
    const queue: ArdSource[] = [
        { url: new URL(ARD_MANIFEST_PATH, origin).href, required: false, robots: false },
        { url: new URL('/', origin).href, required: false, robots: false },
        { url: new URL('/robots.txt', origin).href, required: false, robots: true }
    ];
    const queued = new Set(queue.map(source => source.url));
    const fetched = new Set<string>();
    const entries = new Map<string, ArdEntry>();
    const sources: string[] = [];
    const warnings: string[] = [];

    const addSource = (value: string, required = false, robots = false) => {
        const url = sameOriginUrl(value, origin);
        if (!url) {
            warnings.push('An advertised ARD source was outside the configured origin.');
            return;
        }
        if (queued.has(url.href) || fetched.has(url.href)) return;
        if (queued.size >= MAX_SOURCE_COUNT) {
            warnings.push('The ARD source count limit was reached.');
            return;
        }
        queued.add(url.href);
        queue.push({ url: url.href, required, robots });
    };

    const addEntry = (candidate: unknown) => {
        const entry = normalizeArdEntry(candidate);
        if (!entry || entries.has(entry.identifier)) return;
        if (entries.size >= MAX_ENTRY_COUNT) {
            if (!warnings.includes('The ARD entry count limit was reached.'))
                warnings.push('The ARD entry count limit was reached.');
            return;
        }
        entries.set(entry.identifier, entry);
    };

    while (queue.length > 0) {
        const batch = queue.splice(0, 4);
        const results = await Promise.all(
            batch.map(async source => {
                try {
                    return { source, document: await fetchSource(source.url, origin, fetcher) };
                } catch (error) {
                    return { source, error };
                }
            })
        );

        for (const result of results) {
            fetched.add(result.source.url);
            if ('error' in result) {
                if (result.source.required)
                    throw new Error(
                        `Required ARD source could not be ingested: ${errorMessage(result.error)}`
                    );
                warnings.push(`${result.source.url}: ${errorMessage(result.error)}`);
                continue;
            }

            sources.push(result.document.url);
            const parsed = parseDocument(result.document, result.source);
            warnings.push(...parsed.warnings);
            for (const candidate of parsed.entryNodes) addEntry(candidate);
            for (const source of parsed.sources) addSource(source, false, false);
            if (result.document.url !== result.source.url) fetched.add(result.document.url);
        }
    }

    if (entries.size === 0)
        throw new Error('No valid ARD entries were found in discovered sources.');

    return { entries: Array.from(entries.values()), sources, warnings };
}
