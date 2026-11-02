// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

type ToolInput = Record<string, unknown>;
type Endpoint = (path: string) => string;
type ResponseFormat = 'json' | 'text';

export interface WebMcpTool {
    name: string;
    title: string;
    description: string;
    inputSchema: Record<string, unknown>;
    annotations: { readOnlyHint: boolean };
    execute: (input: ToolInput) => Promise<unknown>;
}

interface ModelContext {
    registerTool(tool: WebMcpTool, options: { signal: AbortSignal }): Promise<undefined>;
}

const AUTHOR_FIELDS = ['profile', 'contact', 'resume', 'funding', 'skills', 'socials'] as const;
const POST_PARTS = ['metadata', 'content'] as const;
const MAX_LIMIT = 100;

class InputError extends Error {}

function failure(message: string) {
    return { error: message };
}

function queryString(params: Record<string, string | number | undefined>) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params))
        if (value !== undefined) search.set(key, String(value));
    const text = search.toString();
    return text ? `?${text}` : '';
}

function requireText(input: ToolInput, key: string, minLength = 1) {
    const value = input[key];
    if (typeof value !== 'string' || value.trim().length < minLength)
        throw new InputError(`${key} must be text of at least ${minLength} characters.`);
    return value.trim();
}

function optionalInteger(input: ToolInput, key: string, min: number, max: number) {
    const value = input[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max)
        throw new InputError(`${key} must be an integer from ${min} to ${max}.`);
    return value;
}

function optionalChoice<T extends string>(input: ToolInput, key: string, choices: readonly T[]) {
    const value = input[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !(choices as readonly string[]).includes(value))
        throw new InputError(`${key} must be one of: ${choices.join(', ')}.`);
    return value as T;
}

function optionalChoices<T extends string>(input: ToolInput, key: string, choices: readonly T[]) {
    const value = input[key];
    if (value === undefined) return undefined;
    if (
        !Array.isArray(value)
        || value.some(
            item => typeof item !== 'string' || !(choices as readonly string[]).includes(item)
        )
    )
        throw new InputError(`${key} must list values from: ${choices.join(', ')}.`);
    return [...new Set(value as T[])];
}

async function failureMessage(response: Response) {
    try {
        const body = (await response.json()) as { error?: { message?: string; details?: string } };
        const message = [body.error?.message, body.error?.details].filter(Boolean).join(' ');
        if (message) return message;
    } catch {
        return `The request failed with status ${response.status}.`;
    }
    return `The request failed with status ${response.status}.`;
}

async function fetchValue(endpoint: Endpoint, path: string, format: ResponseFormat) {
    let response: Response;
    try {
        response = await fetch(endpoint(path));
    } catch {
        return failure('The site API could not be reached.');
    }
    if (!response.ok) return failure(await failureMessage(response));
    try {
        return format === 'json' ? ((await response.json()) as unknown) : await response.text();
    } catch {
        return failure('The site API returned an unreadable response.');
    }
}

function defineTool(
    name: string,
    title: string,
    description: string,
    properties: Record<string, unknown>,
    required: string[],
    run: (input: ToolInput) => Promise<unknown>
): WebMcpTool {
    return {
        name,
        title,
        description,
        inputSchema: { type: 'object', properties, required, additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: async input => {
            const values = input ?? {};
            try {
                const unknown = Object.keys(values).find(key => !(key in properties));
                if (unknown) throw new InputError(`Unknown input: ${unknown}.`);
                return await run(values);
            } catch (error) {
                if (error instanceof InputError) return failure(error.message);
                throw error;
            }
        }
    };
}

const pageProperty = { type: 'integer', minimum: 1, description: 'Page number, starting at 1.' };

export function createWebMcpTools(endpoint: Endpoint): WebMcpTool[] {
    return [
        defineTool(
            'search_posts',
            'Search posts',
            'Search published blog posts by text. Returns matching posts with title, summary and URL.',
            {
                query: { type: 'string', minLength: 2, description: 'Search text.' },
                page: pageProperty
            },
            ['query'],
            input =>
                fetchValue(
                    endpoint,
                    `/search${queryString({
                        q: requireText(input, 'query', 2),
                        page: optionalInteger(input, 'page', 1, Number.MAX_SAFE_INTEGER)
                    })}`,
                    'json'
                )
        ),
        defineTool(
            'list_posts',
            'List posts',
            'List published blog posts, newest first, with pagination.',
            {
                page: pageProperty,
                limit: {
                    type: 'integer',
                    minimum: 1,
                    maximum: MAX_LIMIT,
                    description: 'Posts per page.'
                }
            },
            [],
            input =>
                fetchValue(
                    endpoint,
                    `/blog${queryString({
                        page: optionalInteger(input, 'page', 1, Number.MAX_SAFE_INTEGER),
                        limit: optionalInteger(input, 'limit', 1, MAX_LIMIT)
                    })}`,
                    'json'
                )
        ),
        defineTool(
            'get_post',
            'Get post',
            'Get one blog post by its ID, an ID prefix of at least 7 characters, or its slug. Returns the metadata or the Markdown body.',
            {
                id: { type: 'string', minLength: 1, description: 'Post ID, ID prefix or slug.' },
                part: {
                    type: 'string',
                    enum: [...POST_PARTS],
                    description: 'What to return. Defaults to metadata.'
                }
            },
            ['id'],
            input => {
                const id = requireText(input, 'id');
                const part = optionalChoice(input, 'part', POST_PARTS) ?? 'metadata';
                return part === 'content' ?
                        fetchValue(
                            endpoint,
                            `/blog/content${queryString({ id, output: 'md' })}`,
                            'text'
                        )
                    :   fetchValue(endpoint, `/blog${queryString({ id })}`, 'json');
            }
        ),
        defineTool(
            'get_author',
            'Get author',
            'Get information about the site owner: profile, contact links, resume, funding links, skills and social links.',
            {
                fields: {
                    type: 'array',
                    items: { type: 'string', enum: [...AUTHOR_FIELDS] },
                    uniqueItems: true,
                    description: 'Sections to return. Defaults to all.'
                }
            },
            [],
            input => {
                const fields = optionalChoices(input, 'fields', AUTHOR_FIELDS);
                return fetchValue(
                    endpoint,
                    `/author${queryString({ field: fields?.length ? fields.join(',') : undefined })}`,
                    'json'
                );
            }
        )
    ];
}

async function register(modelContext: ModelContext, tool: WebMcpTool, signal: AbortSignal) {
    try {
        await modelContext.registerTool(tool, { signal });
    } catch (error) {
        console.warn(`Could not register the WebMCP tool ${tool.name}:`, error);
    }
}

function availableModelContexts() {
    const candidates = [
        (document as Document & { modelContext?: ModelContext }).modelContext,
        (navigator as Navigator & { modelContext?: ModelContext }).modelContext
    ];
    return [...new Set(candidates.filter((context): context is ModelContext => !!context))];
}

export function registerWebMcpTools(endpoint: Endpoint): () => void {
    const modelContexts = availableModelContexts();
    if (!modelContexts.length) return () => {};
    const controller = new AbortController();
    const tools = createWebMcpTools(endpoint);
    for (const modelContext of modelContexts)
        for (const tool of tools) void register(modelContext, tool, controller.signal);
    return () => controller.abort();
}
