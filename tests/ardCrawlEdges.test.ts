// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import { crawlArdSources } from '../packages/lib/src/server/ardIngestion.ts';

const siteUrl = 'https://ard.example';
const context = 'https://agenticresourcediscovery.org/context/v1';

const validGraph = JSON.stringify({
    '@context': context,
    '@graph': [
        {
            identifier: 'urn:air:ard.example:page:one',
            displayName: 'One',
            type: 'text/plain',
            url: `${siteUrl}/one`
        }
    ]
});

function fetcherFor(documents: Record<string, () => Response | Promise<Response>>) {
    return (async (input: RequestInfo | URL) => {
        const document = documents[String(input)];
        if (!document) return new Response('missing', { status: 404 });
        return document();
    }) as unknown as typeof fetch;
}

test('reports invalid structured data and oversized manifests as warnings', async () => {
    const result = await crawlArdSources(
        siteUrl,
        fetcherFor({
            [`${siteUrl}/.well-known/ard.json`]: () =>
                new Response('x'.repeat(1_100_000), {
                    headers: { 'content-type': 'application/json' }
                }),
            [`${siteUrl}/`]: () =>
                new Response(
                    `<html><script type="application/ld+json">${validGraph}</script><script type="application/ld+json">{not json</script></html>`,
                    { headers: { 'content-type': 'text/html' } }
                )
        })
    );
    expect(result.warnings.join(' ')).toContain('invalid application/ld+json markup');
    expect(result.warnings.join(' ')).toContain('response size limit');
});

test('ignores a manifest that is not valid JSON and keeps the other entries', async () => {
    const result = await crawlArdSources(
        siteUrl,
        fetcherFor({
            [`${siteUrl}/.well-known/ard.json`]: () =>
                new Response('{not json', { headers: { 'content-type': 'application/json' } }),
            [`${siteUrl}/`]: () =>
                new Response(
                    `<html><script type="application/ld+json">${validGraph}</script></html>`,
                    { headers: { 'content-type': 'text/html' } }
                )
        })
    );
    expect(JSON.stringify(result.entries ?? result)).toContain('urn:air:ard.example:page:one');
});
