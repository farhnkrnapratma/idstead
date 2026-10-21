import type { DiscoveryOperation } from '#lib/server/apiDiscovery.ts';
import { workerBinding } from '#lib/server/workerEnv.ts';
import { EMBEDDING_MODEL } from '#lib/server/aiModels.ts';

const ARD_CONTEXT = 'https://agenticresourcediscovery.org/context/v1';
const ARD_SEARCH_PATH = '/api/ard/search';
const MAX_PAGE_SIZE = 100;
const MIN_RELEVANCE_SCORE = 35;
const STOP_WORDS = new Set([
    'a',
    'an',
    'and',
    'can',
    'find',
    'for',
    'help',
    'how',
    'i',
    'in',
    'me',
    'of',
    'on',
    'or',
    'please',
    'the',
    'this',
    'to',
    'use',
    'with'
]);

export interface ArdEntry {
    '@context'?: unknown;
    '@id'?: string;
    identifier: string;
    displayName: string;
    type: string;
    url?: string;
    data?: unknown;
    description?: string;
    capabilities?: string[];
    tags?: string[];
    representativeQueries?: string[];
    [term: string]: unknown;
}

type ArdEntryFields = {
    displayName: string;
    type: string;
    url: string;
    description: string;
    capabilities: string[];
    tags: string[];
    representativeQueries: string[];
} & Record<string, unknown>;

export interface ArdSearchRequest {
    query: { text: string; context?: unknown; filter?: Record<string, string[]> };
    federation: 'auto' | 'referrals' | 'none';
    pageSize: number;
    offset: number;
}

export interface ArdExploreRequest {
    query: { text?: string; context?: unknown; filter?: Record<string, string[]> };
    facets: { field: string; limit: number; minCount: number }[];
}

interface ArdListFilter {
    field: string;
    operator: '=' | '>' | '>=' | '<' | '<=';
    value: string;
}

export interface ArdListRequest {
    filters: ArdListFilter[];
    orderBy: string;
    descending: boolean;
    pageSize: number;
    offset: number;
}

export class ArdRequestError extends Error {
    readonly errorCode: string;

    constructor(errorCode: string, message: string) {
        super(message);
        this.errorCode = errorCode;
    }
}

export async function resolveArdAiBinding(platformAi: unknown): Promise<unknown> {
    if (platformAi !== undefined && platformAi !== null) return platformAi;
    return workerBinding('AI');
}

function slug(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function createEntry(
    base: string,
    namespace: string,
    name: string,
    fields: ArdEntryFields
): ArdEntry {
    const host = new URL(base).hostname.toLowerCase();
    const identifier = `urn:air:${host}:${namespace}:${slug(name)}`;
    return { '@context': ARD_CONTEXT, '@id': identifier, identifier, ...fields };
}

export function createArdEntries(base: string, operations: DiscoveryOperation[]): ArdEntry[] {
    const registry = createEntry(base, 'registry', 'local', {
        displayName: 'Local Agentic Resource Registry',
        type: 'application/ai-registry+json',
        url: `${base}${ARD_SEARCH_PATH}`,
        description:
            "Searches this domain's public GET API endpoints and agent skill documents using semantic relevance. No upstream registries or trust verification are configured.",
        capabilities: ['ard-search', 'semantic-search'],
        tags: ['registry', 'local'],
        representativeQueries: [
            'Find public API endpoints and agent skills hosted on this domain.',
            "Search this site's public agentic resources."
        ]
    });

    const apis = operations
        .filter(operation => !operation.path.includes('{'))
        .map(operation => {
            const readableName = operation.name.replaceAll('-', ' ');
            return createEntry(base, 'api', operation.name, {
                displayName: `${readableName} API`,
                type: operation.mediaType,
                url: operation.url,
                description: operation.description,
                capabilities: ['read'],
                tags: ['api', 'read-only'],
                representativeQueries: [
                    operation.description,
                    `How can I use the ${readableName} API?`
                ]
            });
        });

    const skills = operations.map(operation => {
        const readableName = operation.name.replaceAll('-', ' ');
        return createEntry(base, 'skill', operation.name, {
            displayName: `${readableName} API Skill`,
            type: 'application/ai-skill+md',
            url: `${base}/.well-known/agent-skills/${operation.name}/SKILL.md`,
            description: operation.description,
            capabilities: ['read-api', 'agent-instructions'],
            tags: ['skill', 'api', 'read-only'],
            representativeQueries: [
                operation.description,
                `Help an AI agent use the ${readableName} API.`
            ]
        });
    });

    return [registry, ...apis, ...skills];
}

export function createArdManifest(base: string, operations: DiscoveryOperation[]) {
    return { entries: createArdEntries(base, operations) };
}

export const MAX_ARD_BODY_BYTES = 16_384;

export async function readArdRequestJson(request: Request): Promise<unknown> {
    const mediaType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
    if (mediaType !== 'application/json' && !mediaType?.endsWith('+json'))
        throw new ArdRequestError('INVALID_ARGUMENT', 'Content-Type must be application/json.');

    const contentLength = request.headers.get('content-length');
    if (
        contentLength !== null
        && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_ARD_BODY_BYTES)
    )
        throw new ArdRequestError(
            'INVALID_ARGUMENT',
            `Request body must not exceed ${MAX_ARD_BODY_BYTES} bytes.`
        );

    const reader = request.body?.getReader();
    if (!reader) throw new ArdRequestError('INVALID_ARGUMENT', 'Request body is required.');

    const decoder = new TextDecoder();
    let body = '';
    let byteLength = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        byteLength += value.byteLength;
        if (byteLength > MAX_ARD_BODY_BYTES) {
            await reader.cancel();
            throw new ArdRequestError(
                'INVALID_ARGUMENT',
                `Request body must not exceed ${MAX_ARD_BODY_BYTES} bytes.`
            );
        }
        body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();

    try {
        return JSON.parse(body);
    } catch {
        throw new ArdRequestError('INVALID_ARGUMENT', 'Request body must contain valid JSON.');
    }
}

export function ardErrorResponse(error: ArdRequestError): Response {
    return new Response(JSON.stringify({ errorCode: error.errorCode, message: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
}

function invalid(message: string): never {
    throw new ArdRequestError('INVALID_ARGUMENT', message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodePageToken(token: unknown): number {
    if (token === undefined) return 0;
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(token))
        return invalid('pageToken must be a valid pagination token.');

    let decoded: string;
    try {
        decoded = atob(
            token.replaceAll('-', '+').replaceAll('_', '/')
                + '='.repeat((4 - (token.length % 4)) % 4)
        );
    } catch {
        return invalid('pageToken must be a valid pagination token.');
    }
    const offset = Number(decoded);
    if (!Number.isSafeInteger(offset) || offset < 0)
        return invalid('pageToken must identify a valid result offset.');
    return offset;
}

function parseFilter(value: unknown): Record<string, string[]> | undefined {
    if (value === undefined) return undefined;
    if (!isRecord(value)) return invalid('query.filter must be an object.');

    const filters: Record<string, string[]> = Object.create(null);

    for (const [field, rawValues] of Object.entries(value)) {
        if (
            !field.trim()
            || field.length > 256
            || field
                .split('.')
                .some(segment => ['__proto__', 'prototype', 'constructor'].includes(segment))
        )
            return invalid(`query.filter contains an invalid term path: "${field}".`);
        const values = Array.isArray(rawValues) ? rawValues : [rawValues];
        if (values.length === 0)
            return invalid(`query.filter.${field} must be a string or non-empty array of strings.`);
        const strings: string[] = [];
        for (const item of values) {
            if (typeof item !== 'string' || item.length > 256)
                return invalid(
                    `query.filter.${field} must be a string or non-empty array of strings.`
                );
            strings.push(item);
        }
        Object.defineProperty(filters, field, {
            value: strings,
            enumerable: true,
            configurable: true,
            writable: true
        });
    }

    return filters;
}

function parseQuery(value: unknown, requireText: boolean): ArdExploreRequest['query'] {
    if (!isRecord(value)) return invalid('query must be an object.');
    const allowedQueryFields = new Set(['@context', 'filter', 'text']);
    if (Object.keys(value).some(field => !allowedQueryFields.has(field)))
        return invalid('query contains an unsupported field.');
    const context = value['@context'];
    if (
        context !== undefined
        && typeof context !== 'string'
        && !isRecord(context)
        && !Array.isArray(context)
    )
        return invalid('query.@context must be a string, object, or array.');
    let text: string | undefined;
    if (value.text !== undefined) {
        if (typeof value.text !== 'string' || !value.text.trim() || value.text.length > 2000)
            return invalid('query.text must be a non-empty string of at most 2000 characters.');
        text = value.text.trim();
    } else if (requireText) {
        return invalid('query.text must be a non-empty string of at most 2000 characters.');
    }
    const filter = parseFilter(value.filter);
    return {
        ...(text ? { text } : {}),
        ...(context !== undefined ? { context } : {}),
        ...(filter ? { filter } : {})
    };
}

function parseSearchRequest(value: unknown): ArdSearchRequest {
    if (!isRecord(value)) return invalid('Request body must be a JSON object.');
    const allowedRequestFields = new Set(['federation', 'pageSize', 'pageToken', 'query']);
    if (Object.keys(value).some(field => !allowedRequestFields.has(field)))
        return invalid('Request body contains an unsupported field.');
    const query = parseQuery(value.query, true);
    const federation = value.federation === undefined ? 'auto' : value.federation;
    if (federation !== 'auto' && federation !== 'referrals' && federation !== 'none')
        return invalid('federation must be auto, referrals, or none.');

    const pageSize = value.pageSize === undefined ? 10 : value.pageSize;
    if (
        typeof pageSize !== 'number'
        || !Number.isInteger(pageSize)
        || pageSize < 1
        || pageSize > MAX_PAGE_SIZE
    )
        return invalid('pageSize must be an integer between 1 and 100.');

    if (!query.text)
        return invalid('query.text must be a non-empty string of at most 2000 characters.');
    return {
        query: { ...query, text: query.text },
        federation,
        pageSize,
        offset: decodePageToken(value.pageToken)
    };
}

export function validateArdExploreRequest(value: unknown): ArdExploreRequest {
    if (!isRecord(value)) return invalid('Request body must be a JSON object.');
    if (Object.keys(value).some(field => !['query', 'resultType'].includes(field)))
        return invalid('Request body contains an unsupported field.');
    if (!isRecord(value.resultType)) return invalid('resultType must be an object.');
    if (
        Object.keys(value.resultType).some(field => field !== 'facets')
        || !Array.isArray(value.resultType.facets)
    )
        return invalid('resultType.facets must be an array.');
    const query = value.query === undefined ? {} : parseQuery(value.query, false);
    const facets = value.resultType.facets.map((facet, index) => {
        if (!isRecord(facet)) return invalid(`resultType.facets[${index}] must be an object.`);
        if (Object.keys(facet).some(field => !['field', 'limit', 'minCount'].includes(field)))
            return invalid(`resultType.facets[${index}] contains an unsupported field.`);
        if (typeof facet.field !== 'string' || !facet.field.trim() || facet.field.length > 256)
            return invalid(
                `resultType.facets[${index}].field must be a non-empty string of at most 256 characters.`
            );
        const limit = facet.limit === undefined ? 20 : facet.limit;
        if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 100)
            return invalid(
                `resultType.facets[${index}].limit must be an integer between 1 and 100.`
            );
        const minCount = facet.minCount === undefined ? 1 : facet.minCount;
        if (typeof minCount !== 'number' || !Number.isInteger(minCount) || minCount < 0)
            return invalid(`resultType.facets[${index}].minCount must be a non-negative integer.`);
        return { field: facet.field.trim(), limit, minCount };
    });
    return { query, facets };
}

function parseListFilter(filter: string | null): ArdListFilter[] {
    if (filter === null || !filter.trim()) return [];
    if (filter.length > 2048) return invalid('filter must not exceed 2048 characters.');
    const clauses = filter.split(/\s+AND\s+/i).map(expression => {
        const match =
            /^(displayName|type|publisherId|createdAfter|updatedAfter)\s*(>=|<=|=|>|<)\s*'([^']{0,256})'$/i.exec(
                expression.trim()
            );
        if (!match) return invalid('filter contains an unsupported expression.');
        return {
            field: match[1],
            operator: match[2] as ArdListFilter['operator'],
            value: match[3]
        };
    });
    for (const clause of clauses) {
        if (
            ['createdAfter', 'updatedAfter'].includes(clause.field)
            && !Number.isFinite(Date.parse(clause.value))
        )
            return invalid(`${clause.field} must be a valid ISO 8601 date.`);
        if (!['createdAfter', 'updatedAfter'].includes(clause.field) && clause.operator !== '=')
            return invalid(`${clause.field} only supports the "=" operator.`);
    }
    return clauses;
}

export function parseArdListRequest(url: URL): ArdListRequest {
    const pageSizeValue = url.searchParams.get('pageSize');
    const pageSize = pageSizeValue === null ? 20 : Number(pageSizeValue);
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE)
        return invalid('pageSize must be an integer between 1 and 100.');
    const orderBy = url.searchParams.get('orderBy') ?? 'displayName';
    const orderMatch =
        /^(displayName|identifier|type|publisherId|createdAt|updatedAt|url)(?:\s+(ASC|DESC))?$/i.exec(
            orderBy.trim()
        );
    if (!orderMatch)
        return invalid(
            'orderBy must be displayName, identifier, type, publisherId, createdAt, updatedAt, or url.'
        );
    const normalizedOrderBy = {
        createdat: 'createdAt',
        displayname: 'displayName',
        identifier: 'identifier',
        publisherid: 'publisherId',
        type: 'type',
        updatedat: 'updatedAt',
        url: 'url'
    }[orderMatch[1].toLowerCase()];
    if (!normalizedOrderBy) return invalid('orderBy contains an unsupported field.');
    return {
        filters: parseListFilter(url.searchParams.get('filter')),
        orderBy: normalizedOrderBy,
        descending: orderMatch[2]?.toUpperCase() === 'DESC',
        pageSize,
        offset: decodePageToken(url.searchParams.get('pageToken') ?? undefined)
    };
}

function queryTokens(value: string): string[] {
    return Array.from(
        new Set(
            (value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
                token => token.length > 1 && !STOP_WORDS.has(token)
            )
        )
    );
}

const BASE_CONTEXT = 'https://agenticresourcediscovery.org/ns#';
const BASE_TERMS: Record<string, string> = {
    id: '@id',
    identifier: `${BASE_CONTEXT}identifier`,
    displayName: `${BASE_CONTEXT}displayName`,
    type: `${BASE_CONTEXT}mediaType`,
    url: `${BASE_CONTEXT}url`,
    data: `${BASE_CONTEXT}data`,
    representativeQueries: `${BASE_CONTEXT}representativeQueries`,
    capabilities: `${BASE_CONTEXT}capabilities`,
    tags: `${BASE_CONTEXT}tags`,
    description: `${BASE_CONTEXT}description`,
    version: `${BASE_CONTEXT}version`,
    updatedAt: `${BASE_CONTEXT}updatedAt`,
    metadata: `${BASE_CONTEXT}metadata`,
    trustManifest: `${BASE_CONTEXT}trustManifest`
};

function contextEntries(context: unknown): Record<string, unknown>[] {
    if (Array.isArray(context)) return context.flatMap(contextEntries);
    return isRecord(context) ? [context] : [];
}

function contextDefinition(term: string, contexts: unknown[]): unknown {
    for (const context of contexts.slice().reverse()) {
        for (const entries of contextEntries(context)) {
            if (term in entries) return entries[term];
        }
    }
    return undefined;
}

function expandIri(value: string, contexts: unknown[]): string {
    if (value.startsWith('@') || /^[a-z][a-z0-9+.-]*:/i.test(value)) {
        const separator = value.indexOf(':');
        if (separator > 0 && !value.slice(0, separator).includes('/')) {
            const prefix = value.slice(0, separator);
            const suffix = value.slice(separator + 1);
            const definition = contextDefinition(prefix, contexts);
            if (typeof definition === 'string') return definition + suffix;
            if (isRecord(definition) && typeof definition['@id'] === 'string')
                return definition['@id'] + suffix;
        }
        return value;
    }
    const definition = contextDefinition(value, contexts);
    if (typeof definition === 'string') return expandIri(definition, contexts);
    if (isRecord(definition) && typeof definition['@id'] === 'string')
        return expandIri(definition['@id'], contexts);
    const vocab = contextDefinition('@vocab', contexts);
    return (typeof vocab === 'string' ? vocab : BASE_CONTEXT) + value;
}

function termIri(term: string, contexts: unknown[]): string {
    if (term === 'publisher') return 'https://agenticresourcediscovery.org/ns#publisher';
    const builtIn = BASE_TERMS[term];
    if (builtIn && contextDefinition(term, contexts) === undefined) return builtIn;
    return expandIri(term, contexts);
}

export function normalizeArdEntry(value: unknown): ArdEntry | undefined {
    if (!isRecord(value)) return undefined;
    const context = value['@context'];
    if (
        context !== undefined
        && context !== null
        && typeof context !== 'string'
        && !isRecord(context)
        && !Array.isArray(context)
    )
        return undefined;

    const contexts = [context];
    const findTerm = (term: string) => {
        if (Object.hasOwn(value, term)) return { found: true, value: value[term] };
        const iri = termIri(term, []);
        const matches = Object.entries(value).filter(
            ([key]) => !key.startsWith('@') && termIri(key, contexts) === iri
        );
        return matches.length === 1 ?
                { found: true, value: matches[0][1] }
            :   { found: matches.length > 1, value: undefined };
    };
    const identifier = findTerm('identifier');
    const displayName = findTerm('displayName');
    const type = findTerm('type');
    const url = findTerm('url');
    const data = findTerm('data');
    if (
        !identifier.found
        || typeof identifier.value !== 'string'
        || !/^urn:air:[^:\s]+:[^:\s]+:[^:\s]+$/.test(identifier.value)
        || !displayName.found
        || typeof displayName.value !== 'string'
        || !displayName.value.trim()
        || !type.found
        || typeof type.value !== 'string'
        || !type.value.includes('/')
        || /\s/.test(type.value)
        || url.found === data.found
    )
        return undefined;

    if (url.found) {
        if (typeof url.value !== 'string') return undefined;
        try {
            new URL(url.value);
        } catch {
            return undefined;
        }
    }

    if (value['@id'] !== undefined && typeof value['@id'] !== 'string') return undefined;

    const normalized: ArdEntry = {
        ...value,
        identifier: identifier.value,
        displayName: displayName.value,
        type: type.value,
        ...(url.found ? { url: url.value as string } : { data: data.value })
    };

    for (const term of ['description', 'capabilities', 'tags', 'representativeQueries']) {
        const resolved = findTerm(term);
        if (!resolved.found) continue;
        if (term === 'description' && typeof resolved.value !== 'string') return undefined;
        if (
            term !== 'description'
            && (!Array.isArray(resolved.value)
                || !resolved.value.every(item => typeof item === 'string'))
        )
            return undefined;
        Object.assign(normalized, { [term]: resolved.value });
    }

    return normalized;
}

function valuesForPath(entry: ArdEntry, path: string, queryContext?: unknown): unknown[] {
    if (path === 'publisher') return [entry.identifier.split(':')[2] ?? ''];
    const segments = path.split('.');
    if (segments.some(segment => ['__proto__', 'prototype', 'constructor'].includes(segment)))
        return [];
    const rootIri = termIri(segments[0], [queryContext]);
    const matchingKeys = Object.keys(entry).filter(
        key => !key.startsWith('@') && termIri(key, [entry['@context']]) === rootIri
    );
    let values = matchingKeys.map(key => entry[key]);
    for (const segment of segments.slice(1)) {
        values = values.flatMap(value =>
            isRecord(value) && Object.hasOwn(value, segment) ? [value[segment]] : []
        );
    }
    return values.flatMap(value => (Array.isArray(value) ? value : [value]));
}

const SUPPORTED_FILTERS = new Set([
    'publisher',
    ...Object.keys(BASE_TERMS).filter(term => term !== 'id')
]);

function supportsFilter(field: string, entries: ArdEntry[], context?: unknown): boolean {
    if (SUPPORTED_FILTERS.has(field.split('.')[0])) return true;
    const contexts = [context];
    const iri = termIri(field.split('.')[0], contexts);
    return entries.some(entry =>
        Object.keys(entry).some(
            key => !key.startsWith('@') && termIri(key, [entry['@context']]) === iri
        )
    );
}

function entryMatchesFilter(
    entry: ArdEntry,
    filters: Record<string, string[]>,
    context?: unknown
): boolean {
    return Object.entries(filters).every(([field, acceptedValues]) => {
        const candidates = valuesForPath(entry, field, context);
        return acceptedValues.some(accepted =>
            candidates.some(candidate => String(candidate).toLowerCase() === accepted.toLowerCase())
        );
    });
}

function lexicalRelevanceScore(entry: ArdEntry, tokens: string[]): number {
    const representativeTokens = new Set(
        queryTokens((entry.representativeQueries ?? []).join(' '))
    );
    const prominentTokens = new Set(
        queryTokens(
            [entry.displayName, ...(entry.capabilities ?? []), ...(entry.tags ?? [])].join(' ')
        )
    );
    const descriptionTokens = new Set(queryTokens(entry.description ?? ''));
    const points = tokens.reduce(
        (score, token) =>
            score
            + (representativeTokens.has(token) ? 3
            : prominentTokens.has(token) ? 2
            : descriptionTokens.has(token) ? 1
            : 0),
        0
    );
    return Math.round((points / (tokens.length * 3)) * 100);
}

function encodePageToken(offset: number): string {
    return btoa(String(offset)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function searchArdEntries(value: unknown, base: string, entries: ArdEntry[]) {
    const request = parseSearchRequest(value);
    return searchValidatedArdRequest(request, base, entries);
}

export function validateArdSearchRequest(value: unknown): ArdSearchRequest {
    return parseSearchRequest(value);
}

function validateSupportedFilters(
    filters: Record<string, string[]> | undefined,
    entries: ArdEntry[],
    context?: unknown
): void {
    for (const field of Object.keys(filters ?? {})) {
        if (!supportsFilter(field, entries, context))
            return invalid(`Filtering by "${field}" is not supported.`);
    }
}

export function searchValidatedArdRequest(
    request: ArdSearchRequest,
    base: string,
    entries: ArdEntry[],
    semanticScores?: Map<string, number>
) {
    validateSupportedFilters(request.query.filter, entries, request.query.context);
    const tokens = queryTokens(request.query.text);

    const results = entries
        .filter(entry =>
            request.query.filter ?
                entryMatchesFilter(entry, request.query.filter, request.query.context)
            :   true
        )
        .map(entry => ({
            ...entry,
            score: semanticScores?.get(entry.identifier) ?? lexicalRelevanceScore(entry, tokens),
            source: `${base}${ARD_SEARCH_PATH}`
        }))
        .filter(entry => (semanticScores ? entry.score >= MIN_RELEVANCE_SCORE : entry.score > 0))
        .sort(
            (left, right) =>
                right.score - left.score || left.identifier.localeCompare(right.identifier)
        );

    const page = results.slice(request.offset, request.offset + request.pageSize);
    const nextOffset = request.offset + page.length;
    return {
        results: page,
        ...(nextOffset < results.length ? { pageToken: encodePageToken(nextOffset) } : {}),
        ...(request.federation === 'referrals' ? { referrals: [] } : {})
    };
}

interface ArdAiBinding {
    run(model: string, input: { text: string[] }): Promise<unknown>;
}

let cachedEntryVectors: { key: string; vectors: Promise<number[][]> } | undefined;

function isArdAiBinding(value: unknown): value is ArdAiBinding {
    return isRecord(value) && typeof value.run === 'function';
}

function isNumberArray(value: unknown): value is number[] {
    return (
        Array.isArray(value)
        && value.every(item => typeof item === 'number' && Number.isFinite(item))
    );
}

async function createEmbeddings(ai: ArdAiBinding, texts: string[]): Promise<number[][]> {
    const response = await ai.run(EMBEDDING_MODEL, { text: texts });
    const data =
        isRecord(response) && isRecord(response.result) ? response.result.data
        : isRecord(response) ? response.data
        : undefined;
    if (!Array.isArray(data) || data.length !== texts.length)
        throw new Error('Workers AI returned an invalid ARD embedding response.');

    return data.map(item => {
        const vector =
            Array.isArray(item) ? item
            : isRecord(item) ? item.embedding
            : undefined;
        if (!isNumberArray(vector) || vector.length === 0)
            throw new Error('Workers AI returned an invalid ARD embedding vector.');
        return vector;
    });
}

function entryEmbeddingText(entry: ArdEntry): string {
    return [
        entry.displayName,
        entry.description ?? '',
        ...(entry.representativeQueries ?? []),
        ...(entry.capabilities ?? []),
        ...(entry.tags ?? []),
        entry.type,
        entry.url ?? ''
    ].join('\n');
}

async function getEntryVectors(ai: ArdAiBinding, entries: ArdEntry[]): Promise<number[][]> {
    const texts = entries.map(entryEmbeddingText);
    const key = JSON.stringify(texts);
    let cache = cachedEntryVectors;
    if (cache?.key !== key) {
        cache = { key, vectors: createEmbeddings(ai, texts) };
        cachedEntryVectors = cache;
    }
    try {
        return await cache.vectors;
    } catch (error) {
        if (cachedEntryVectors === cache) cachedEntryVectors = undefined;
        throw error;
    }
}

function cosineSimilarity(left: number[], right: number[]): number {
    if (left.length !== right.length)
        throw new Error('Workers AI returned ARD embeddings with different dimensions.');
    let dot = 0;
    let leftMagnitude = 0;
    let rightMagnitude = 0;
    for (let index = 0; index < left.length; index++) {
        dot += left[index] * right[index];
        leftMagnitude += left[index] ** 2;
        rightMagnitude += right[index] ** 2;
    }
    if (leftMagnitude === 0 || rightMagnitude === 0)
        throw new Error('Workers AI returned an empty ARD embedding vector.');
    return dot / Math.sqrt(leftMagnitude * rightMagnitude);
}

async function semanticScores(
    query: string,
    ai: ArdAiBinding,
    entries: ArdEntry[]
): Promise<Map<string, number>> {
    const [queryVectors, entryVectors] = await Promise.all([
        createEmbeddings(ai, [query]),
        getEntryVectors(ai, entries)
    ]);
    const queryVector = queryVectors[0];
    return new Map(
        entries.map((entry, index) => {
            const similarity = cosineSimilarity(queryVector, entryVectors[index]);
            return [entry.identifier, Math.round(Math.max(0, Math.min(1, similarity)) * 100)];
        })
    );
}

export async function searchArdEntriesWithAI(
    request: ArdSearchRequest,
    base: string,
    ai: unknown,
    entries: ArdEntry[]
) {
    validateSupportedFilters(request.query.filter, entries, request.query.context);
    if (!isArdAiBinding(ai))
        throw new Error('Workers AI binding is required for semantic ARD search.');
    const scores = await semanticScores(request.query.text, ai, entries);
    return searchValidatedArdRequest(request, base, entries, scores);
}

export function exploreArdEntries(
    request: ArdExploreRequest,
    _base: string,
    entries: ArdEntry[],
    semanticRelevance?: Map<string, number>
) {
    validateSupportedFilters(request.query.filter, entries, request.query.context);
    const tokens = request.query.text ? queryTokens(request.query.text) : undefined;
    const matched = entries.filter(entry => {
        if (
            request.query.filter
            && !entryMatchesFilter(entry, request.query.filter, request.query.context)
        )
            return false;
        if (!tokens) return true;
        const score =
            semanticRelevance?.get(entry.identifier) ?? lexicalRelevanceScore(entry, tokens);
        return score >= (semanticRelevance ? MIN_RELEVANCE_SCORE : 1);
    });
    const facets = Object.fromEntries(
        request.facets.map(({ field, limit, minCount }) => {
            if (!supportsFilter(field, entries, request.query.context))
                return invalid(`Faceting by "${field}" is not supported.`);
            const counts = new Map<string, number>();
            const otherValues = new Set<string>();
            for (const entry of matched) {
                const values = new Set(
                    valuesForPath(entry, field, request.query.context)
                        .filter(
                            value =>
                                typeof value === 'string'
                                || typeof value === 'number'
                                || typeof value === 'boolean'
                        )
                        .map(String)
                );
                for (const bucket of values) counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
            }
            const allBuckets = Array.from(counts, ([value, count]) => ({ value, count }))
                .filter(bucket => bucket.count >= minCount)
                .sort(
                    (left, right) =>
                        right.count - left.count || left.value.localeCompare(right.value)
                );
            const buckets = allBuckets.slice(0, limit);
            const otherBucketValues = new Set(allBuckets.slice(limit).map(bucket => bucket.value));
            for (const entry of matched) {
                if (
                    valuesForPath(entry, field, request.query.context).some(value =>
                        otherBucketValues.has(String(value))
                    )
                )
                    otherValues.add(entry.identifier);
            }
            const otherCount = otherValues.size;
            return [field, { buckets, ...(otherCount > 0 ? { otherCount } : {}) }];
        })
    );
    return { resultType: 'facets' as const, facets };
}

export async function exploreArdEntriesWithAI(
    request: ArdExploreRequest,
    base: string,
    ai: unknown,
    entries: ArdEntry[]
) {
    validateSupportedFilters(request.query.filter, entries, request.query.context);
    if (!request.query.text) return exploreArdEntries(request, base, entries);
    if (!isArdAiBinding(ai))
        throw new Error('Workers AI binding is required for semantic ARD Explore.');
    const scores = await semanticScores(request.query.text, ai, entries);
    return exploreArdEntries(request, base, entries, scores);
}

function listEntryMatchesFilters(entry: ArdEntry, filters: ArdListFilter[]): boolean {
    return filters.every(({ field, operator, value }) => {
        let actual: string | undefined;
        if (field === 'publisherId') actual = entry.identifier.split(':')[2];
        else if (field === 'createdAfter' || field === 'updatedAfter') {
            const key = field === 'createdAfter' ? 'createdAt' : 'updatedAt';
            const rawDate = entry[key];
            actual = typeof rawDate === 'string' ? rawDate : undefined;
        } else {
            const rawValue = entry[field];
            actual = typeof rawValue === 'string' ? rawValue : undefined;
        }
        if (actual === undefined) return false;
        if (operator === '=')
            return value
                .split(',')
                .some(accepted => actual.toLowerCase() === accepted.trim().toLowerCase());
        const left = Date.parse(actual);
        const right = Date.parse(value);
        if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
        if (operator === '>') return left > right;
        if (operator === '>=') return left >= right;
        if (operator === '<') return left < right;
        return left <= right;
    });
}

export function listArdEntries(request: ArdListRequest, _base: string, entries: ArdEntry[]) {
    const sorted = entries
        .filter(entry => listEntryMatchesFilters(entry, request.filters))
        .slice()
        .sort((left, right) => {
            const leftValue =
                request.orderBy === 'publisherId' ?
                    (left.identifier.split(':')[2] ?? '')
                :   String(left[request.orderBy] ?? '');
            const rightValue =
                request.orderBy === 'publisherId' ?
                    (right.identifier.split(':')[2] ?? '')
                :   String(right[request.orderBy] ?? '');
            const order =
                leftValue.localeCompare(rightValue, undefined, { sensitivity: 'base' })
                || left.identifier.localeCompare(right.identifier);
            return request.descending ? -order : order;
        });
    const items = sorted.slice(request.offset, request.offset + request.pageSize);
    const nextOffset = request.offset + items.length;
    return {
        items,
        total: sorted.length,
        ...(nextOffset < sorted.length ? { pageToken: encodePageToken(nextOffset) } : {})
    };
}
