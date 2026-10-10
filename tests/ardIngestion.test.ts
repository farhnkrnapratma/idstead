import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { createArdIndexCache, loadArdIndex } from '../src/lib/server/ardIndex';
import { crawlArdSources } from '../src/lib/server/ardIngestion';
import type { ArdEntry } from '../src/lib/server/ard';

const siteUrl = 'https://ard.example';
const context = 'https://agenticresourcediscovery.org/context/v1';
const namespace = 'https://agenticresourcediscovery.org/ns#';

function entry(name: string, url: string): ArdEntry {
    return {
        identifier: `urn:air:ard.example:api:${name}`,
        displayName: name,
        type: 'application/json',
        url
    };
}

function createSiteFetcher() {
    const requests: string[] = [];
    const documents = new Map([
        [
            `${siteUrl}/.well-known/ard.json`,
            {
                contentType: 'application/json',
                body: JSON.stringify({
                    entries: [
                        entry('manifest-resource', `${siteUrl}/manifest-resource`),
                        {
                            '@context': {
                                ard: namespace,
                                name: 'ard:displayName',
                                format: 'ard:mediaType',
                                inline: 'ard:data'
                            },
                            identifier: 'urn:air:ard.example:agent:inline-resource',
                            name: 'Inline resource',
                            format: 'application/json',
                            inline: { message: 'hello' }
                        }
                    ]
                })
            }
        ],
        [
            `${siteUrl}/`,
            {
                contentType: 'text/html',
                body: `<html><head><link rel="alternate ard" href="/entries.json"><script type="application/ld+json">${JSON.stringify(
                    {
                        '@context': context,
                        '@graph': [
                            {
                                identifier: 'urn:air:ard.example:page:embedded-resource',
                                displayName: 'Embedded resource',
                                type: 'text/plain',
                                url: `${siteUrl}/embedded.txt`,
                                representativeQueries: ['Find embedded content']
                            }
                        ]
                    }
                )}</script></head></html>`
            }
        ],
        [
            `${siteUrl}/robots.txt`,
            {
                contentType: 'text/plain',
                body: `User-agent: *\nAgentmap: ${siteUrl}/agentmap.json\n`
            }
        ],
        [
            `${siteUrl}/entries.json`,
            {
                contentType: 'application/json',
                body: JSON.stringify({
                    entries: [entry('linked-resource', `${siteUrl}/linked-resource`)]
                })
            }
        ],
        [
            `${siteUrl}/agentmap.json`,
            {
                contentType: 'application/json',
                body: JSON.stringify({
                    entries: [entry('agentmap-resource', `${siteUrl}/agentmap-resource`)]
                })
            }
        ]
    ]);

    const fetcher: typeof fetch = async (input, init) => {
        const url = String(input);
        requests.push(url);
        expect(init?.redirect).toBe('manual');
        const document = documents.get(url);
        if (!document) return new Response('Not found', { status: 404 });
        return new Response(document.body, { headers: { 'Content-Type': document.contentType } });
    };

    return { fetcher, requests };
}

describe('ARD web ingestion', () => {
    test('ingests manifests, rel links, Agentmap sources, and in-page JSON-LD', async () => {
        const { fetcher, requests } = createSiteFetcher();
        const result = await crawlArdSources(siteUrl, fetcher);

        expect(result.entries.map(item => item.identifier)).toEqual([
            'urn:air:ard.example:api:manifest-resource',
            'urn:air:ard.example:agent:inline-resource',
            'urn:air:ard.example:page:embedded-resource',
            'urn:air:ard.example:api:linked-resource',
            'urn:air:ard.example:api:agentmap-resource'
        ]);
        expect(result.entries[1].data).toEqual({ message: 'hello' });
        expect(result.sources).toHaveLength(5);
        expect(requests).toHaveLength(5);
        expect(result.warnings).toEqual([]);
    });

    test('rejects off-origin sources and redirects', async () => {
        const requests: string[] = [];
        const fetcher: typeof fetch = async input => {
            const url = String(input);
            requests.push(url);
            if (url === `${siteUrl}/.well-known/ard.json`)
                return new Response(null, {
                    status: 302,
                    headers: { Location: 'https://internal.example/ard.json' }
                });
            if (url === `${siteUrl}/`)
                return new Response(
                    `<link rel="ard" href="https://external.example/ard.json"><script type="application/ld+json">${JSON.stringify(
                        entry('root', `${siteUrl}/root`)
                    )}</script>`,
                    { headers: { 'Content-Type': 'text/html' } }
                );
            return new Response('No directives');
        };

        const result = await crawlArdSources(siteUrl, fetcher);
        expect(requests).not.toContain('https://internal.example/ard.json');
        expect(requests).not.toContain('https://external.example/ard.json');
        expect(result.entries.map(item => item.identifier)).toEqual([
            'urn:air:ard.example:api:root'
        ]);
        expect(result.warnings).toContain(
            `${siteUrl}/.well-known/ard.json: ARD source redirect left the configured origin.`
        );
        expect(result.warnings).toContain(
            'An advertised ARD source was outside the configured origin.'
        );
    });

    test('rejects source documents that exceed the configured byte limit', async () => {
        const fetcher: typeof fetch = async input => {
            if (String(input) === `${siteUrl}/.well-known/ard.json`)
                return new Response('{}', {
                    headers: { 'Content-Type': 'application/json', 'Content-Length': '1048577' }
                });
            return new Response(
                `<script type="application/ld+json">${JSON.stringify(
                    entry('root', `${siteUrl}/root`)
                )}</script>`,
                { headers: { 'Content-Type': 'text/html' } }
            );
        };

        const result = await crawlArdSources(siteUrl, fetcher);
        expect(result.entries).toHaveLength(1);
        expect(result.warnings).toContain(
            `${siteUrl}/.well-known/ard.json: ARD source exceeded the response size limit.`
        );
    });
});

describe('ARD persistent index', () => {
    test('writes a snapshot and reuses it from memory and persistent storage', async () => {
        const { fetcher } = createSiteFetcher();
        let reads = 0;
        let writes = 0;
        let stored: { entries: ArdEntry[]; indexedAt: string } | undefined;
        const store = {
            async read() {
                reads++;
                return stored ?? null;
            },
            async write(
                _siteUrl: string,
                entries: ArdEntry[],
                _sources: string[],
                indexedAt: string
            ) {
                writes++;
                stored = { entries, indexedAt };
            }
        };
        const cache = createArdIndexCache();
        const now = () => 1000;
        const first = await loadArdIndex(siteUrl, store, fetcher, cache, now);
        const cached = await loadArdIndex(siteUrl, store, fetcher, cache, now);

        expect(cached).toEqual(first);
        expect(reads).toBe(1);
        expect(writes).toBe(1);
        expect(stored?.entries).toHaveLength(5);

        const fromPersistentStorage = await loadArdIndex(
            siteUrl,
            store,
            fetcher,
            createArdIndexCache(),
            now
        );
        expect(fromPersistentStorage).toEqual(first);
        expect(reads).toBe(2);
        expect(writes).toBe(1);
    });
});

const migration = await readFile(
    new URL('../supabase/migrations/20261007220802_ard_resource_index.sql', import.meta.url),
    'utf8'
);

describe('ARD index migration', () => {
    test('keeps registry snapshots private to the service role', () => {
        expect(migration).toContain('alter table public.db_ard_index enable row level security');
        expect(migration).toContain(
            'revoke all on public.db_ard_index from public, anon, authenticated'
        );
        expect(migration).toContain(
            'grant select, insert, update on public.db_ard_index to service_role'
        );
    });

    test('bounds the stored manifest and discovery source list', () => {
        expect(migration).toContain("jsonb_typeof(entries) = 'array'");
        expect(migration).toContain('jsonb_array_length(entries) <= 1000');
        expect(migration).toContain('pg_column_size(entries) <= 4194304');
        expect(migration).toContain('cardinality(sources) <= 32');
    });
});
