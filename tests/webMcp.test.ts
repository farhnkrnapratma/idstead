// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
    createWebMcpTools,
    registerWebMcpTools,
    type WebMcpTool
} from '../apps/web/src/lib/webMcp.ts';

const endpoint = (path: string) => `https://api.example.com/v1${path}`;
const originalFetch = globalThis.fetch;
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');

let requested: string[] = [];
let nextResponse: () => Response;

function stubFetch(respond: () => Response) {
    requested = [];
    nextResponse = respond;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        requested.push(String(input));
        return nextResponse();
    }) as typeof fetch;
}

function stubDocument(modelContext?: unknown) {
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        writable: true,
        value: modelContext === undefined ? {} : { modelContext }
    });
}

function tool(name: string): WebMcpTool {
    const found = createWebMcpTools(endpoint).find(candidate => candidate.name === name);
    if (!found) throw new Error(`Missing tool ${name}`);
    return found;
}

beforeEach(() => {
    stubFetch(() => new Response('{}'));
    stubDocument();
});

afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
    Reflect.deleteProperty(globalThis.navigator, 'modelContext');
});

function recordingContext() {
    const registered: { tool: WebMcpTool; signal: AbortSignal }[] = [];
    return {
        registered,
        registerTool(registeredTool: WebMcpTool, options: { signal: AbortSignal }) {
            registered.push({ tool: registeredTool, signal: options.signal });
            return Promise.resolve();
        }
    };
}

function stubNavigator(modelContext: unknown) {
    Object.defineProperty(globalThis.navigator, 'modelContext', {
        configurable: true,
        value: modelContext
    });
}

describe('WebMCP registration', () => {
    test('does nothing when the browser has no model context', () => {
        const cleanup = registerWebMcpTools(endpoint);
        expect(() => cleanup()).not.toThrow();
    });

    test('registers every tool on document.modelContext with one shared abort signal', () => {
        const registered: { tool: WebMcpTool; signal: AbortSignal }[] = [];
        stubDocument({
            registerTool(registeredTool: WebMcpTool, options: { signal: AbortSignal }) {
                registered.push({ tool: registeredTool, signal: options.signal });
                return Promise.resolve();
            }
        });

        const cleanup = registerWebMcpTools(endpoint);

        expect(registered.map(entry => entry.tool.name)).toEqual([
            'search_posts',
            'list_posts',
            'get_post',
            'get_author'
        ]);
        expect(new Set(registered.map(entry => entry.signal)).size).toBe(1);
        expect(registered.every(entry => !entry.signal.aborted)).toBe(true);
        cleanup();
        expect(registered.every(entry => entry.signal.aborted)).toBe(true);
    });

    test('registers on navigator.modelContext for hosts that only provide it', () => {
        const context = recordingContext();
        stubNavigator(context);

        const cleanup = registerWebMcpTools(endpoint);

        expect(context.registered.length).toBe(4);
        cleanup();
        expect(context.registered.every(entry => entry.signal.aborted)).toBe(true);
    });

    test('registers on both objects when they differ and once when they are the same', () => {
        const documentContext = recordingContext();
        const navigatorContext = recordingContext();
        stubDocument(documentContext);
        stubNavigator(navigatorContext);
        registerWebMcpTools(endpoint);
        expect(documentContext.registered.length).toBe(4);
        expect(navigatorContext.registered.length).toBe(4);

        const shared = recordingContext();
        stubDocument(shared);
        stubNavigator(shared);
        registerWebMcpTools(endpoint);
        expect(shared.registered.length).toBe(4);
    });

    test('keeps the page working and logs each tool whose registration is rejected', async () => {
        const warnings: unknown[][] = [];
        const originalWarn = console.warn;
        console.warn = (...args: unknown[]) => void warnings.push(args);
        try {
            stubDocument({ registerTool: () => Promise.reject(new Error('duplicate tool')) });

            const cleanup = registerWebMcpTools(endpoint);
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(() => cleanup()).not.toThrow();
        } finally {
            console.warn = originalWarn;
        }
        expect(warnings.length).toBe(4);
        expect(String(warnings[0][0])).toContain('search_posts');
        expect((warnings[0][1] as Error).message).toBe('duplicate tool');
    });

    test('logs a registration that throws before returning a promise', async () => {
        const warnings: unknown[][] = [];
        const originalWarn = console.warn;
        console.warn = (...args: unknown[]) => void warnings.push(args);
        try {
            stubDocument({
                registerTool: () => {
                    throw new TypeError('unsupported option');
                }
            });
            registerWebMcpTools(endpoint);
            await new Promise(resolve => setTimeout(resolve, 0));
        } finally {
            console.warn = originalWarn;
        }
        expect(warnings.length).toBe(4);
        expect((warnings[0][1] as Error).message).toBe('unsupported option');
    });
});

describe('WebMCP tool definitions', () => {
    test('every tool is read-only with a title and a strict object schema', () => {
        for (const definition of createWebMcpTools(endpoint)) {
            expect(definition.annotations.readOnlyHint).toBe(true);
            expect(definition.title.length).toBeGreaterThan(0);
            expect(definition.description.length).toBeGreaterThan(0);
            expect(definition.inputSchema.type).toBe('object');
            expect(definition.inputSchema.additionalProperties).toBe(false);
        }
    });

    test('no tool reaches a write endpoint', async () => {
        const inputs: Record<string, Record<string, unknown>> = {
            search_posts: { query: 'svelte' },
            list_posts: {},
            get_post: { id: 'hello-world', part: 'content' },
            get_author: { fields: ['profile', 'resume'] }
        };
        for (const definition of createWebMcpTools(endpoint))
            await definition.execute(inputs[definition.name]);
        expect(requested.length).toBe(4);
        expect(requested.some(url => url.includes('/api/internal'))).toBe(false);
    });
});

describe('search_posts', () => {
    test('queries the search endpoint and returns the parsed response', async () => {
        stubFetch(() => new Response('{"data":[]}'));
        const result = await tool('search_posts').execute({ query: ' svelte 5 ', page: 2 });
        expect(requested).toEqual(['https://api.example.com/v1/search?q=svelte+5&page=2']);
        expect(result).toEqual({ data: [] });
    });

    test('rejects short queries and bad pages without fetching', async () => {
        const short = await tool('search_posts').execute({ query: 'a' });
        const page = await tool('search_posts').execute({ query: 'svelte', page: 0 });
        expect(short).toHaveProperty('error');
        expect(page).toHaveProperty('error');
        expect(requested).toEqual([]);
    });
});

describe('list_posts', () => {
    test('passes page and limit', async () => {
        await tool('list_posts').execute({ page: 3, limit: 10 });
        expect(requested).toEqual(['https://api.example.com/v1/blog?page=3&limit=10']);
    });

    test('lists with defaults and caps the limit', async () => {
        await tool('list_posts').execute({});
        expect(requested).toEqual(['https://api.example.com/v1/blog']);
        const tooMany = await tool('list_posts').execute({ limit: 101 });
        expect(tooMany).toHaveProperty('error');
        expect(requested.length).toBe(1);
    });
});

describe('get_post', () => {
    test('returns metadata by default and the Markdown body on request', async () => {
        stubFetch(() => new Response('{"slug":"hello-world"}'));
        const metadata = await tool('get_post').execute({ id: 'hello-world' });
        stubFetch(() => new Response('# Hello\n\nBody'));
        const content = await tool('get_post').execute({ id: 'hello-world', part: 'content' });
        expect(metadata).toEqual({ slug: 'hello-world' });
        expect(content).toBe('# Hello\n\nBody');
    });

    test('calls the post endpoint for metadata', async () => {
        await tool('get_post').execute({ id: 'hello-world' });
        expect(requested).toEqual(['https://api.example.com/v1/blog?id=hello-world']);
    });

    test('calls the content endpoint for the Markdown body', async () => {
        await tool('get_post').execute({ id: 'hello-world', part: 'content' });
        expect(requested).toEqual([
            'https://api.example.com/v1/blog/content?id=hello-world&output=md'
        ]);
    });

    test('requires an id and a known part', async () => {
        const missing = await tool('get_post').execute({});
        const unknown = await tool('get_post').execute({ id: 'hello-world', part: 'comments' });
        expect(missing).toHaveProperty('error');
        expect(unknown).toHaveProperty('error');
        expect(requested).toEqual([]);
    });

    test('returns the API error message instead of throwing', async () => {
        stubFetch(
            () =>
                new Response(
                    JSON.stringify({
                        error: { code: 'BLOG_POST_NOT_FOUND', message: 'Blog post not found.' }
                    }),
                    { status: 404 }
                )
        );
        const result = await tool('get_post').execute({ id: 'missing' });
        expect(result).toEqual({ error: 'Blog post not found.' });
    });
});

describe('get_author', () => {
    test('requests the chosen sections once each', async () => {
        await tool('get_author').execute({ fields: ['profile', 'skills', 'profile'] });
        expect(requested).toEqual(['https://api.example.com/v1/author?field=profile%2Cskills']);
    });

    test('returns every section by default and rejects unknown ones', async () => {
        await tool('get_author').execute({});
        expect(requested).toEqual(['https://api.example.com/v1/author']);
        const unknown = await tool('get_author').execute({ fields: ['projects'] });
        expect(unknown).toHaveProperty('error');
        expect(requested.length).toBe(1);
    });
});

describe('failure handling', () => {
    test('rejects unknown input keys', async () => {
        const result = await tool('list_posts').execute({ sort: 'asc' });
        expect(result).toHaveProperty('error');
        expect(requested).toEqual([]);
    });

    test('returns a network failure as an error value', async () => {
        globalThis.fetch = (() =>
            Promise.reject(new TypeError('offline'))) as unknown as typeof fetch;
        const result = await tool('list_posts').execute({});
        expect(result).toEqual({ error: 'The site API could not be reached.' });
    });

    test('falls back to the status when the error body is not JSON', async () => {
        stubFetch(() => new Response('upstream down', { status: 502 }));
        const result = await tool('list_posts').execute({});
        expect(result).toEqual({ error: 'The request failed with status 502.' });
    });

    test('returns an unreadable success body as an error value', async () => {
        stubFetch(() => new Response('not json'));
        const result = await tool('list_posts').execute({});
        expect(result).toEqual({ error: 'The site API returned an unreadable response.' });
    });
});
