// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import { publicResponse } from '#lib/server/publicMetadata.ts';

const documentation = `# Agentic Resource Discovery

This site publishes an ARD v0.91 manifest at [/.well-known/ard.json](/.well-known/ard.json), advertises it with \`rel="ard"\`, and exposes Search, Explore, and List. On first access and every five minutes, the registry ingests the manifest, ARD-linked sources, same-origin \`Agentmap\` sources, and in-page JSON-LD. Entries and source URLs are persisted atomically in the service-role-only \`db_ard_index\` table. External sources are not fetched. See the [ARD specification](https://agenticresourcediscovery.org/spec/).

## Search

\`POST /api/ard/search\` searches the persisted ARD index. It requires no authentication and accepts \`application/json\` request bodies up to 16384 bytes. \`query.text\` is required, non-empty, and limited to 2000 characters. \`federation\` accepts \`auto\`, \`referrals\`, or \`none\` (default: \`auto\`).

\`\`\`http
POST /api/ard/search
Content-Type: application/json

{
  "query": {
    "text": "find public blog posts"
  },
  "federation": "none",
  "pageSize": 10
}
\`\`\`

The response contains ranked \`results\`. Each result includes an ARD \`identifier\`, an integer \`score\` from 0 to 100, and \`source\`. A \`pageToken\` is returned when another page is available; include it on the next request to continue. \`pageSize\` defaults to 10 and accepts integers from 1 to 100.

The \`query\` object supports optional \`@context\`, required \`text\`, and optional \`filter\`. Filter keys resolve through the ARD base context and any inline query context; unknown term paths are matched against the entries' declared JSON-LD contexts. Values may be strings or arrays of strings; values for one term use OR matching and different terms use AND matching. Filters on \`metadata\` and \`trustManifest\` support literal nested JSON paths.

Search ranks ingested entries using multilingual text embeddings from the configured Cloudflare Workers AI binding. Semantic Search and text-filtered Explore return HTTP 500 if that binding is unavailable; non-text Explore and List do not require it. A registry-defined relevance cutoff of 35/100 is shared by Search and text-filtered Explore. Scores indicate semantic relevance only, not trust or safety. Trust verification is not implemented. No upstream registries or referral peers are configured, so \`auto\` searches only this registry and \`referrals\` returns an empty list.

Malformed requests return HTTP 400 with \`{ "errorCode": "INVALID_ARGUMENT", "message": "..." }\`. The shared API rate limit returns HTTP 429 with \`RATE_LIMIT_EXCEEDED\` and a \`Retry-After\` header. Index storage or required source failures return HTTP 503 with \`INTERNAL_ERROR\` and a \`Retry-After\` header. Worker/model failures return HTTP 500 with \`INTERNAL_ERROR\`.

## Explore

\`POST /api/ard/explore\` accepts an optional \`query\` and required \`resultType.facets\`. Each facet requires a \`field\`; \`limit\` defaults to 20 (maximum 100) and \`minCount\` defaults to 1. Text and filters use the same matched set as Search; facet counts are aggregated across the full set, not a page. Explore is local-only and returns \`{ "resultType": "facets", "facets": { ... } }\`.

\`\`\`json
{
  "query": {"text": "find blog content"},
  "resultType": {"facets": [{"field": "type"}, {"field": "tags", "limit": 10}]}
}
\`\`\`

## List

\`GET /api/ard/agents\` supports \`filter\`, \`orderBy\`, \`pageSize\`, and opaque \`pageToken\` parameters. Results are deterministic and returned as \`items\`, \`total\`, and an optional next-page token. List does not use relevance ranking and uses the same persisted index as Search and Explore.

\`\`\`http
GET /api/ard/agents?pageSize=10&orderBy=displayName%20ASC
\`\`\`
`;

export const GET: RequestHandler = async ({ request }) => {
    const response = await publicResponse(request, documentation, 'text/markdown; charset=utf-8');
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
};
