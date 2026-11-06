// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    ArdRequestError,
    ardErrorResponse,
    exploreArdEntries,
    exploreArdEntriesWithAI,
    listArdEntries,
    normalizeArdEntry,
    parseArdListRequest,
    readArdRequestJson,
    resolveArdAiBinding,
    searchArdEntries,
    searchArdEntriesWithAI,
    validateArdExploreRequest,
    validateArdSearchRequest
} from '../packages/lib/src/server/ard';
import type { ArdEntry } from '../packages/lib/src/server/ard';

const NS = 'https://agenticresourcediscovery.org/ns#';
const base = 'https://example.com';

function entry(name: string, extra: Record<string, unknown> = {}): ArdEntry {
    return {
        identifier: `urn:air:${name}.test:api:${name}`,
        displayName: name.toUpperCase(),
        type: 'application/json',
        url: `https://${name}.test/${name}`,
        ...extra
    } as ArdEntry;
}

const entries = [
    entry('one', {
        description: 'Searches posts',
        tags: ['blog'],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-03-01T00:00:00Z',
        version: 2,
        metadata: { owner: { name: 'ada' }, flag: true, list: { nested: 1 } }
    }),
    entry('two', {
        url: undefined,
        data: { a: 1 },
        capabilities: ['read'],
        representativeQueries: ['find posts'],
        createdAt: 'not a date',
        metadata: { owner: { name: 'grace' }, flag: false }
    }),
    entry('three', { tags: ['blog', 'misc'], updatedAt: '2025-06-01T00:00:00Z' })
];

function jsonRequest(body: BodyInit | null, headers: Record<string, string> = {}) {
    return new Request('https://example.com/api/ard/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body
    });
}

async function thrown(run: () => unknown | Promise<unknown>) {
    try {
        await run();
    } catch (error) {
        return error;
    }
    return undefined;
}

async function reason(run: () => unknown | Promise<unknown>) {
    const error = await thrown(run);
    expect(error).toBeInstanceOf(ArdRequestError);
    return (error as Error).message;
}

describe('ARD request reading', () => {
    test('has no Workers AI binding outside Workers', async () => {
        expect(await resolveArdAiBinding(undefined)).toBeUndefined();
        expect(await resolveArdAiBinding(null)).toBeUndefined();
        const ai = {};
        expect(await resolveArdAiBinding(ai)).toBe(ai);
    });

    test('rejects bad media types, lengths and bodies', async () => {
        expect(
            await reason(() =>
                readArdRequestJson(jsonRequest('{}', { 'content-type': 'text/plain' }))
            )
        ).toMatch(/Content-Type/);
        expect(
            await reason(() => readArdRequestJson(jsonRequest('{}', { 'content-length': 'x' })))
        ).toMatch(/must not exceed/);
        expect(
            await reason(() => readArdRequestJson(jsonRequest('{}', { 'content-length': '99999' })))
        ).toMatch(/must not exceed/);
        expect(await reason(() => readArdRequestJson(jsonRequest(null)))).toBe(
            'Request body is required.'
        );
        expect(
            await reason(() => readArdRequestJson(jsonRequest(`"${'x'.repeat(17_000)}"`)))
        ).toMatch(/must not exceed/);
        expect(await reason(() => readArdRequestJson(jsonRequest('{')))).toBe(
            'Request body must contain valid JSON.'
        );
    });

    test('parses JSON bodies', async () => {
        expect(await readArdRequestJson(jsonRequest('{"a":1}'))).toEqual({ a: 1 });
        expect(
            await readArdRequestJson(
                jsonRequest('[1]', { 'content-type': 'application/vnd.api+json; charset=utf-8' })
            )
        ).toEqual([1]);
    });

    test('renders errors as a 400 response', async () => {
        const response = ardErrorResponse(new ArdRequestError('INVALID_ARGUMENT', 'No.'));
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ errorCode: 'INVALID_ARGUMENT', message: 'No.' });
    });
});

describe('ARD search validation', () => {
    const search = (body: unknown) => validateArdSearchRequest(body);
    const text = { query: { text: 'posts' } };

    test('accepts a minimal request and a filter', () => {
        expect(search(text)).toMatchObject({ federation: 'auto', pageSize: 10, offset: 0 });
        const parsed = search({
            query: { text: ' posts ', '@context': ['x'], filter: { tags: ['blog'], type: 'a' } },
            federation: 'referrals',
            pageToken: 'MQ'
        });
        expect(parsed.query.filter).toEqual({ tags: ['blog'], type: ['a'] });
        expect(parsed.offset).toBe(1);
    });

    test('rejects malformed requests', async () => {
        const cases: Array<[unknown, RegExp]> = [
            [null, /JSON object/],
            [{ ...text, extra: 1 }, /unsupported field/],
            [{ query: 1 }, /query must be an object/],
            [{ query: { text: 'a', extra: 1 } }, /query contains an unsupported field/],
            [{ query: { text: 'a', '@context': 5 } }, /@context must be/],
            [{ query: { text: '   ' } }, /query.text/],
            [{ query: { text: 5 } }, /query.text/],
            [{ query: {} }, /query.text/],
            [{ ...text, federation: 'all' }, /federation/],
            [{ ...text, pageSize: 0 }, /pageSize/],
            [{ ...text, pageSize: '5' }, /pageSize/],
            [{ ...text, pageToken: 5 }, /pageToken must be a valid/],
            [{ ...text, pageToken: 'AAAAA' }, /valid result offset/],
            [{ ...text, pageToken: 'LTE' }, /valid result offset/],
            [{ query: { text: 'a', filter: 'x' } }, /query.filter must be an object/],
            [{ query: { text: 'a', filter: { '': 'x' } } }, /invalid term path/],
            [{ query: { text: 'a', filter: { 'a.constructor': 'x' } } }, /invalid term path/],
            [{ query: { text: 'a', filter: { tags: [] } } }, /non-empty array/],
            [{ query: { text: 'a', filter: { tags: [5] } } }, /non-empty array/]
        ];
        for (const [body, pattern] of cases)
            expect([JSON.stringify(body), await reason(() => search(body))]).toEqual([
                JSON.stringify(body),
                expect.stringMatching(pattern)
            ]);
    });
});

describe('ARD explore validation', () => {
    const explore = (body: unknown) => validateArdExploreRequest(body);
    const facets = [{ field: 'tags' }];

    test('accepts defaults', () => {
        expect(explore({ query: {}, resultType: { facets } }).facets).toEqual([
            { field: 'tags', limit: 20, minCount: 1 }
        ]);
    });

    test('rejects malformed requests', async () => {
        const cases: Array<[unknown, RegExp]> = [
            [null, /JSON object/],
            [{ query: {}, resultType: { facets }, extra: 1 }, /unsupported field/],
            [{ query: {} }, /resultType must be an object/],
            [{ query: {}, resultType: { facets: 'x' } }, /facets must be an array/],
            [{ query: {}, resultType: { facets: [1] } }, /must be an object/],
            [{ query: {}, resultType: { facets: [{ field: 'a', x: 1 }] } }, /unsupported field/],
            [{ query: {}, resultType: { facets: [{ field: ' ' }] } }, /field must be/],
            [{ query: {}, resultType: { facets: [{ field: 5 }] } }, /field must be/],
            [{ query: {}, resultType: { facets: [{ field: 'a', limit: 0 }] } }, /limit must be/],
            [{ query: {}, resultType: { facets: [{ field: 'a', limit: 1.5 }] } }, /limit must be/],
            [{ query: {}, resultType: { facets: [{ field: 'a', minCount: -1 }] } }, /minCount/],
            [{ query: {}, resultType: { facets: [{ field: 'a', minCount: 'x' }] } }, /minCount/]
        ];
        for (const [body, pattern] of cases)
            expect(await reason(() => explore(body))).toMatch(pattern);
    });
});

describe('ARD list requests', () => {
    const list = (query: string) =>
        parseArdListRequest(new URL(`https://example.com/list?${query}`));

    test('applies defaults and parses ordering and paging', () => {
        expect(list('')).toMatchObject({ orderBy: 'displayName', descending: false, pageSize: 20 });
        expect(list('orderBy=UpdatedAt%20desc&pageSize=5&pageToken=Mg')).toMatchObject({
            orderBy: 'updatedAt',
            descending: true,
            pageSize: 5,
            offset: 2
        });
        expect(list('filter=%20').filters).toEqual([]);
    });

    test('parses filters', () => {
        const parsed = list(
            `filter=${encodeURIComponent("type='a,b' AND createdAfter>='2026-01-01' and publisherId='one.test'")}`
        );
        expect(parsed.filters).toEqual([
            { field: 'type', operator: '=', value: 'a,b' },
            { field: 'createdAfter', operator: '>=', value: '2026-01-01' },
            { field: 'publisherId', operator: '=', value: 'one.test' }
        ]);
    });

    test('rejects malformed requests', async () => {
        const cases: Array<[string, RegExp]> = [
            ['pageSize=0', /pageSize/],
            ['pageSize=x', /pageSize/],
            ['pageSize=101', /pageSize/],
            ['orderBy=nope', /orderBy must be/],
            [`filter=${'x'.repeat(2049)}`, /2048/],
            ['filter=nonsense', /unsupported expression/],
            [`filter=${encodeURIComponent("createdAfter='tomorrow'")}`, /valid ISO 8601/],
            [`filter=${encodeURIComponent("type>'a'")}`, /only supports the "="/]
        ];
        for (const [query, pattern] of cases)
            expect(await reason(() => list(query))).toMatch(pattern);
    });

    test('filters, orders and pages entries', () => {
        const run = (query: string) => listArdEntries(list(query), base, entries);
        const ids = (query: string) => run(query).items.map(item => item.displayName);
        expect(ids('')).toEqual(['ONE', 'THREE', 'TWO']);
        expect(ids('orderBy=publisherId%20DESC')).toEqual(['TWO', 'THREE', 'ONE']);
        expect(ids('orderBy=url')).toEqual(['TWO', 'ONE', 'THREE']);
        expect(ids('orderBy=type%20DESC')).toEqual(['TWO', 'THREE', 'ONE']);
        const where = (expression: string) => ids(`filter=${encodeURIComponent(expression)}`);
        expect(where("publisherId='one.test'")).toEqual(['ONE']);
        expect(where("displayName='one, two'")).toEqual(['ONE', 'TWO']);
        expect(where("createdAfter>'2025-01-01'")).toEqual(['ONE']);
        expect(where("createdAfter>='2026-01-01T00:00:00Z'")).toEqual(['ONE']);
        expect(where("updatedAfter<'2026-01-01'")).toEqual(['THREE']);
        expect(where("updatedAfter<='2026-03-01T00:00:00Z'")).toEqual(['ONE', 'THREE']);
        expect(where("createdAfter<'2030-01-01'")).toEqual(['ONE']);
        expect(where("type='application/json' AND type='x'")).toEqual([]);
        expect(where("displayName='ONE' AND updatedAfter>'2026-01-01'")).toEqual(['ONE']);
        const page = run('pageSize=2');
        expect(page.total).toBe(3);
        expect(page.pageToken).toBeDefined();
        expect(run('pageSize=2&pageToken=Mg').pageToken).toBeUndefined();
    });
});

describe('ARD entry normalization', () => {
    const valid = {
        identifier: 'urn:air:a.test:api:x',
        displayName: 'X',
        type: 'application/json',
        url: 'https://a.test/x'
    };

    test('accepts plain and compact entries', () => {
        expect(normalizeArdEntry(valid)).toMatchObject(valid);
        expect(
            normalizeArdEntry({
                identifier: valid.identifier,
                displayName: valid.displayName,
                type: valid.type,
                data: { a: 1 },
                description: 'd',
                tags: ['t']
            })
        ).toMatchObject({ data: { a: 1 }, description: 'd', tags: ['t'] });
        expect(normalizeArdEntry({ ...valid, '@context': null, '@id': 'x' })).toBeDefined();
    });

    test('expands terms defined by a context', () => {
        const compact = normalizeArdEntry({
            '@context': [
                {
                    ex: { '@id': NS },
                    label: { '@id': `${NS}displayName` },
                    where: `${NS}url`,
                    '@vocab': 'https://vocab.test/'
                }
            ],
            'ex:identifier': 'urn:air:a.test:api:y',
            label: 'Y',
            'ex:mediaType': 'text/plain',
            where: 'https://a.test/y',
            other: 'x'
        });
        expect(compact).toMatchObject({ identifier: 'urn:air:a.test:api:y', displayName: 'Y' });
        const prefixed = normalizeArdEntry({
            '@context': { ex: NS },
            'ex:identifier': 'urn:air:a.test:api:z',
            'ex:displayName': 'Z',
            'ex:mediaType': 'text/plain',
            'ex:url': 'https://a.test/z'
        });
        expect(prefixed?.displayName).toBe('Z');
    });

    test('rejects invalid entries', () => {
        const bad: unknown[] = [
            null,
            [],
            { ...valid, '@context': 5 },
            { ...valid, identifier: 'nope' },
            { ...valid, identifier: 5 },
            { ...valid, displayName: ' ' },
            { ...valid, type: 'plain' },
            { ...valid, type: 'a/b c' },
            { ...valid, data: 1 },
            { ...valid, url: undefined },
            { ...valid, url: 5 },
            { ...valid, url: 'not a url' },
            { ...valid, '@id': 5 },
            { ...valid, description: 5 },
            { ...valid, tags: 'x' },
            { ...valid, tags: [1] },
            {
                '@context': { a: `${NS}displayName`, b: `${NS}displayName` },
                identifier: valid.identifier,
                a: 'A',
                b: 'B',
                type: valid.type,
                url: valid.url
            }
        ];
        for (const value of bad) expect(normalizeArdEntry(value)).toBeUndefined();
    });
});

describe('ARD lexical search and explore', () => {
    const request = (extra: Record<string, unknown> = {}) =>
        validateArdSearchRequest({ query: { text: 'posts' }, ...extra });

    test('ranks, pages and honors federation', () => {
        const all = searchArdEntries({ query: { text: 'posts blog' }, pageSize: 1 }, base, entries);
        expect(all.results).toHaveLength(1);
        expect(all.pageToken).toBeDefined();
        const referrals = searchArdEntries(
            { query: { text: 'posts' }, federation: 'referrals' },
            base,
            entries
        );
        expect(referrals.referrals).toEqual([]);
    });

    test('rejects unsupported filter fields', async () => {
        const message = await reason(() =>
            searchArdEntries({ query: { text: 'posts', filter: { nope: 'x' } } }, base, entries)
        );
        expect(message).toBeDefined();
        expect(
            searchArdEntries({ query: { text: 'posts', filter: { tags: 'blog' } } }, base, entries)
                .results
        ).toHaveLength(1);
    });

    test('facets values, nested paths, limits and other counts', async () => {
        const facet = (field: string, extra: Record<string, unknown> = {}, query = {}) =>
            exploreArdEntries(
                validateArdExploreRequest({ query, resultType: { facets: [{ field, ...extra }] } }),
                base,
                entries
            ).facets[field] as {
                buckets: Array<{ value: string; count: number }>;
                otherCount?: number;
            };
        expect(facet('tags').buckets[0]).toEqual({ value: 'blog', count: 2 });
        expect(facet('tags', { limit: 1 }).otherCount).toBe(1);
        expect(facet('tags', { minCount: 2 }).buckets).toHaveLength(1);
        expect(facet('version').buckets).toEqual([{ value: '2', count: 1 }]);
        expect(facet('metadata.flag').buckets.map(bucket => bucket.value)).toEqual([
            'false',
            'true'
        ]);
        expect(facet('metadata.owner.name').buckets).toHaveLength(2);
        expect(facet('metadata.list').buckets).toEqual([]);
        expect(facet('metadata.missing.deeper').buckets).toEqual([]);
        expect(facet('publisher').buckets).toHaveLength(3);
        expect(facet('tags', {}, { text: 'posts' }).buckets).toEqual([{ value: 'blog', count: 1 }]);
        expect(facet('tags', {}, { filter: { type: 'application/json' } }).buckets.length).toBe(2);
        expect(facet('tags.__proto__').buckets).toEqual([]);
        expect(
            await reason(() =>
                exploreArdEntries(
                    validateArdExploreRequest({
                        query: {},
                        resultType: { facets: [{ field: 'unknown' }] }
                    }),
                    base,
                    entries
                )
            )
        ).toMatch(/not supported/);
    });

    test('resolves custom terms through the query context', () => {
        const custom = [
            { ...entries[0], '@context': { owner: `${NS}tags` }, owner: ['blog'] } as ArdEntry
        ];
        expect(
            searchArdEntries(
                {
                    query: {
                        text: 'posts',
                        '@context': { owner: `${NS}tags` },
                        filter: { owner: 'blog' }
                    }
                },
                base,
                custom
            ).results
        ).toHaveLength(1);
    });
});

describe('ARD semantic search', () => {
    function binding(shape: (texts: string[]) => unknown, calls: string[][] = []) {
        return {
            run: async (_model: string, input: { text: string[] }) => {
                calls.push(input.text);
                return shape(input.text);
            }
        };
    }
    const unit = (texts: string[]) => texts.map(() => [1, 0]);
    const unitData = (texts: string[]) => ({ data: unit(texts) });
    const request = validateArdSearchRequest({ query: { text: 'posts' } });

    test('scores entries with embeddings from either response shape', async () => {
        const nested = await searchArdEntriesWithAI(
            request,
            base,
            binding(texts => ({ result: { data: unit(texts) } })),
            entries
        );
        expect(nested.results.map(result => result.score)).toEqual([100, 100, 100]);
        const flat = await searchArdEntriesWithAI(
            request,
            base,
            binding(texts => ({ data: texts.map(() => ({ embedding: [1, 0] })) })),
            entries
        );
        expect(flat.results).toHaveLength(3);
    });

    test('rejects an unreadable page token', () => {
        const real = globalThis.atob;
        globalThis.atob = () => {
            throw new Error('bad');
        };
        try {
            expect(() =>
                validateArdSearchRequest({ query: { text: 'a' }, pageToken: 'AAAAA' })
            ).toThrow(/valid pagination token/);
        } finally {
            globalThis.atob = real;
        }
    });

    test('requires a binding and valid filters', async () => {
        expect(
            String(await thrown(() => searchArdEntriesWithAI(request, base, {}, entries)))
        ).toMatch(/binding is required/);
        const filtered = validateArdSearchRequest({ query: { text: 'a', filter: { nope: 'x' } } });
        expect(
            await thrown(() => searchArdEntriesWithAI(filtered, base, binding(unitData), entries))
        ).toBeInstanceOf(ArdRequestError);
    });

    test('rejects invalid embedding responses', async () => {
        const failures: unknown[] = [
            () => 'x',
            () => ({ data: [[1, 0]] }),
            () => ({ result: {} }),
            (texts: string[]) => ({ data: texts.map(() => 'x') }),
            (texts: string[]) => ({ data: texts.map(() => []) }),
            (texts: string[]) => ({ data: texts.map(() => ['a']) })
        ];
        for (const [index, shape] of failures.entries())
            expect(
                String(
                    await thrown(() =>
                        searchArdEntriesWithAI(
                            request,
                            base,
                            binding(shape as (texts: string[]) => unknown),
                            entries.map(item => ({
                                ...item,
                                displayName: `${item.displayName}${index}`
                            }))
                        )
                    )
                )
            ).toMatch(/invalid ARD embedding/);
    });

    test('rejects mismatched and empty vectors', async () => {
        const mismatch = binding(texts => ({
            data: texts.map(text => (text === 'posts' ? [1, 0, 0] : [1, 0]))
        }));
        expect(
            String(await thrown(() => searchArdEntriesWithAI(request, base, mismatch, entries)))
        ).toMatch(/different dimensions/);
        const empty = binding(texts => ({ data: texts.map(() => [0, 0]) }));
        expect(
            String(await thrown(() => searchArdEntriesWithAI(request, base, empty, entries)))
        ).toMatch(/empty ARD embedding/);
    });

    test('reuses cached entry vectors and drops them after a failure', async () => {
        const fresh = entries.map(item => ({ ...item, description: `${item.description} cache` }));
        const calls: string[][] = [];
        let fail = true;
        const flaky = {
            run: async (_model: string, input: { text: string[] }) => {
                calls.push(input.text);
                if (fail && input.text.length > 1) throw new Error('offline');
                return { data: input.text.map(() => [1, 0]) };
            }
        };
        expect(
            await thrown(() => searchArdEntriesWithAI(request, base, flaky, fresh))
        ).toBeDefined();
        fail = false;
        await searchArdEntriesWithAI(request, base, flaky, fresh);
        const before = calls.length;
        await searchArdEntriesWithAI(request, base, flaky, fresh);
        expect(calls.length).toBe(before + 1);
    });

    test('supports semantic explore', async () => {
        const facetsRequest = validateArdExploreRequest({
            query: { text: 'posts' },
            resultType: { facets: [{ field: 'tags' }] }
        });
        const semantic = await exploreArdEntriesWithAI(
            facetsRequest,
            base,
            binding(unitData),
            entries
        );
        expect(semantic.facets.tags.buckets[0].value).toBe('blog');
        const textless = validateArdExploreRequest({
            query: {},
            resultType: { facets: [{ field: 'tags' }] }
        });
        expect(
            (await exploreArdEntriesWithAI(textless, base, undefined, entries)).facets.tags
        ).toBeDefined();
        expect(
            String(await thrown(() => exploreArdEntriesWithAI(facetsRequest, base, {}, entries)))
        ).toMatch(/binding is required/);
        const bad = validateArdExploreRequest({
            query: { filter: { nope: 'x' } },
            resultType: { facets: [{ field: 'tags' }] }
        });
        expect(
            await thrown(() => exploreArdEntriesWithAI(bad, base, binding(unitData), entries))
        ).toBeInstanceOf(ArdRequestError);
    });
});
