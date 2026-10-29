import { describe, expect, test } from 'bun:test';
import {
    ArdRequestError,
    createArdEntries,
    createArdManifest,
    exploreArdEntries,
    listArdEntries,
    parseArdListRequest,
    resolveArdAiBinding,
    searchArdEntries,
    searchArdEntriesWithAI,
    validateArdExploreRequest
} from '../packages/lib/src/server/ard';
import type { ArdEntry } from '../packages/lib/src/server/ard';
import { discoveryOperations } from '../packages/lib/src/server/apiDiscovery';

const base = 'https://example.com';
const operations = discoveryOperations('https://api.example.com');
const localEntries = () => createArdEntries(base, operations);

describe('ARD manifest', () => {
    test('publishes valid, domain-anchored API, Skill, and registry entries', () => {
        const manifest = createArdManifest(base, operations);

        expect(manifest.entries.length).toBeGreaterThan(1);
        for (const entry of manifest.entries) {
            expect(entry['@context']).toBe('https://agenticresourcediscovery.org/context/v1');
            expect(entry['@id']).toBe(entry.identifier);
            expect(entry.identifier).toMatch(/^urn:air:example\.com:[a-z]+:[a-z0-9._-]+$/);
            expect(entry.displayName.length).toBeGreaterThan(0);
            expect(entry.type).toContain('/');
            expect(new URL(entry.url ?? '').protocol).toBe('https:');
            expect(entry.representativeQueries?.length).toBeGreaterThanOrEqual(2);
            expect(entry.representativeQueries?.length).toBeLessThanOrEqual(5);
        }

        expect(
            manifest.entries.find(entry => entry.type === 'application/ai-registry+json')?.url
        ).toBe(`${base}/api/ard/search`);
        expect(
            manifest.entries.some(
                entry =>
                    entry.type === 'application/ai-skill+md'
                    && entry.url?.includes('/.well-known/agent-skills/')
            )
        ).toBe(true);
        expect(manifest.entries.find(entry => entry.url?.endsWith('/v1'))?.type).toBe(
            'text/markdown'
        );
        expect(manifest.entries.find(entry => entry.url?.endsWith('/v1/resume'))?.type).toBe(
            'application/json'
        );
        expect(manifest.entries.some(entry => entry.url?.endsWith('/v1/docs'))).toBe(false);
        expect(localEntries().some(entry => entry.url?.includes('{'))).toBe(false);
        expect(operations.length).toBeGreaterThan(0);
    });
});

describe('ARD search', () => {
    test('prefers the platform AI binding when available', async () => {
        const ai = { run: async () => ({}) };

        expect(await resolveArdAiBinding(ai)).toBe(ai);
    });

    test('ranks matching resources and supports term filters', () => {
        const result = searchArdEntries(
            {
                query: { text: 'search public blog posts', filter: { type: 'application/json' } },
                federation: 'none',
                pageSize: 10
            },
            base,
            localEntries()
        );

        expect(result.results.length).toBeGreaterThan(0);
        expect(result.results[0].score).toBeGreaterThan(0);
        expect(result.results[0].score).toBeLessThanOrEqual(100);
        expect(result.results.every(entry => entry.type === 'application/json')).toBe(true);
        expect(result.results[0].source).toBe(`${base}/api/ard/search`);
    });

    test('returns a continuation token and referrals only when requested', () => {
        const entries = localEntries();
        const firstPage = searchArdEntries(
            { query: { text: 'api' }, federation: 'referrals', pageSize: 1 },
            base,
            entries
        );

        expect(firstPage.results).toHaveLength(1);
        expect(firstPage.pageToken).toBeDefined();
        expect(firstPage.referrals).toEqual([]);

        const secondPage = searchArdEntries(
            {
                query: { text: 'api' },
                federation: 'none',
                pageSize: 1,
                pageToken: firstPage.pageToken
            },
            base,
            entries
        );

        expect(secondPage.results).toHaveLength(1);
        expect(secondPage.results[0].identifier).not.toBe(firstPage.results[0].identifier);
        expect(secondPage).not.toHaveProperty('referrals');
    });

    test('rejects malformed requests and unsupported filter terms', () => {
        try {
            searchArdEntries({}, base, localEntries());
            throw new Error('Expected invalid request to throw.');
        } catch (error) {
            expect(error).toBeInstanceOf(ArdRequestError);
            expect((error as ArdRequestError).errorCode).toBe('INVALID_ARGUMENT');
        }
        expect(() =>
            searchArdEntries(
                { query: { text: 'blog' }, pageToken: 'not-a-token!' },
                base,
                localEntries()
            )
        ).toThrow('pageToken must be a valid pagination token.');
        expect(() => searchArdEntries({ query: { text: '   ' } }, base, localEntries())).toThrow(
            'query.text must be a non-empty string'
        );
        expect(() =>
            searchArdEntries(
                { query: { text: 'find a blog', filter: { unsupported: 'x' } } },
                base,
                localEntries()
            )
        ).toThrow('Filtering by "unsupported" is not supported.');
        expect(() =>
            searchArdEntries({ query: { text: 'blog' }, pageSize: 101 }, base, localEntries())
        ).toThrow('pageSize must be an integer between 1 and 100.');
        expect(() =>
            searchArdEntries({ query: { text: 'blog' }, pageSize: null }, base, localEntries())
        ).toThrow('pageSize must be an integer between 1 and 100.');
    });

    test('returns no matches for unrelated queries', () => {
        const result = searchArdEntries(
            { query: { text: 'quantum spacecraft' } },
            base,
            localEntries()
        );

        expect(result.results).toEqual([]);
        expect(result).not.toHaveProperty('pageToken');
    });

    test('resolves aliased core terms and namespaced extension filters', () => {
        const entries = localEntries();
        const customEntry: ArdEntry = {
            ...entries[0],
            '@context': {
                ard: 'https://agenticresourcediscovery.org/ns#',
                ex: 'https://example.com/vocab#'
            },
            '@id': 'urn:air:example.com:api:regional',
            identifier: 'urn:air:example.com:api:regional',
            displayName: 'Regional resource',
            type: 'application/json',
            url: `${base}/regional`,
            description: 'Regional information',
            capabilities: ['read'],
            tags: ['regional'],
            representativeQueries: ['Find regional information', 'Regional data'],
            'ex:region': 'apac'
        };

        const result = searchArdEntries(
            {
                query: {
                    text: 'regional resource',
                    '@context': {
                        media: 'https://agenticresourcediscovery.org/ns#mediaType',
                        region: 'https://example.com/vocab#region'
                    },
                    filter: { media: 'application/json', region: 'apac' }
                },
                federation: 'none'
            },
            base,
            [customEntry]
        );
        expect(result.results.map(entry => entry.identifier)).toEqual([customEntry.identifier]);
    });

    test('aggregates facets over the full filtered set', () => {
        const request = validateArdExploreRequest({
            query: { filter: { tags: 'api' } },
            resultType: {
                facets: [
                    { field: 'type', limit: 1 },
                    { field: 'publisher', minCount: 1 }
                ]
            }
        });
        const result = exploreArdEntries(request, base, localEntries());
        const typeFacet = result.facets.type as {
            buckets: { value: string; count: number }[];
            otherCount?: number;
        };

        expect(result.resultType).toBe('facets');
        expect(typeFacet.buckets).toHaveLength(1);
        expect(typeFacet.otherCount).toBeGreaterThan(0);
        expect(result.facets.publisher).toEqual({
            buckets: [{ value: 'example.com', count: expect.any(Number) }]
        });
    });

    test('supports deterministic List filtering, ordering, and pagination', () => {
        const list = localEntries();
        const url = new URL(
            'https://example.com/api/ard/agents?filter=type%20%3D%20%27application%2Fjson%2Ctext%2Fmarkdown%27&pageSize=1&orderBy=displayName%20ASC'
        );
        const request = parseArdListRequest(url);
        const firstPage = listArdEntries(request, base, list);

        expect(firstPage.items).toHaveLength(1);
        expect(firstPage.total).toBeGreaterThan(1);
        expect(firstPage.pageToken).toBeDefined();

        const nextPage = listArdEntries(
            { ...request, offset: Number(atob(firstPage.pageToken!)) },
            base,
            list
        );
        expect(nextPage.items[0].identifier).not.toBe(firstPage.items[0].identifier);
    });

    test('ranks and facets semantic matches using Workers AI embeddings', async () => {
        const entries = localEntries().slice(0, 2);
        const weather: ArdEntry = {
            ...entries[0],
            '@id': 'urn:air:example.com:api:weather',
            identifier: 'urn:air:example.com:api:weather',
            displayName: 'Weather forecast',
            description: 'Provides weather and forecast information.',
            representativeQueries: ['Find weather information', 'Get a forecast']
        };
        const blogging: ArdEntry = {
            ...entries[1],
            '@id': 'urn:air:example.com:api:blog',
            identifier: 'urn:air:example.com:api:blog',
            displayName: 'Blog archive',
            description: 'Browse published articles.',
            representativeQueries: ['Find published articles', 'Browse blog posts']
        };
        const ai = {
            run: async (model: string, input: { text: string[] }) => {
                expect(model).toBe('@cf/qwen/qwen3-embedding-0.6b');
                return {
                    result: {
                        data: input.text.map(text => ({
                            embedding:
                                text === 'weather forecast' || /weather|forecast/i.test(text) ?
                                    [1, 0]
                                :   [0, 1]
                        }))
                    }
                };
            }
        };
        const request = {
            query: { text: 'weather forecast' },
            federation: 'none' as const,
            pageSize: 10,
            offset: 0
        };
        const search = await searchArdEntriesWithAI(request, base, ai, [weather, blogging]);
        const explore = exploreArdEntries(
            validateArdExploreRequest({
                query: { text: 'weather forecast' },
                resultType: { facets: [{ field: 'displayName' }] }
            }),
            base,
            [weather, blogging],
            new Map(search.results.map(result => [result.identifier, result.score]))
        );

        expect(search.results.map(result => result.identifier)).toEqual([weather.identifier]);
        expect(search.results[0].score).toBe(100);
        expect(explore.facets.displayName).toEqual({
            buckets: [{ value: weather.displayName, count: 1 }]
        });
    });

    test('does not silently return lexical results when semantic search is unavailable', async () => {
        const request = {
            query: { text: 'weather forecast' },
            federation: 'none' as const,
            pageSize: 10,
            offset: 0
        };

        await expect(
            searchArdEntriesWithAI(request, base, undefined, localEntries())
        ).rejects.toThrow('Workers AI binding is required for semantic ARD search.');
    });
});
