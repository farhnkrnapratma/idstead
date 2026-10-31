// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { openapiSpec } from '#lib/openapi.ts';
import type { ApiContext } from './blog';
import { parseApiParams, resolveOutput } from './params';
import { jsonResponse, textResponse } from './responses';

type Operation = { summary?: string; parameters?: Array<{ name?: string }> };

export function apiIndex() {
    return {
        name: openapiSpec.info.title,
        version: openapiSpec.info.version,
        docs: '/v1',
        openapi: '/v1/openapi.json',
        endpoints: Object.entries(openapiSpec.paths).flatMap(([path, methods]) => {
            const operation = (methods as { get?: Operation }).get;
            if (!operation) return [];
            return [
                {
                    method: 'GET',
                    path,
                    summary: operation.summary ?? '',
                    parameters: (operation.parameters ?? [])
                        .map(parameter => parameter.name)
                        .filter((name): name is string => !!name)
                }
            ];
        })
    };
}

export function renderReadme(readme: string, urls: { apiBase: string; siteUrl: string }) {
    return readme
        .replaceAll('{{API_BASE_URL}}', urls.apiBase.replace(/\/+$/, ''))
        .replaceAll('{{SITE_URL}}', urls.siteUrl.replace(/\/+$/, ''));
}

export async function getRoot(ctx: ApiContext, readme: string) {
    const params = parseApiParams(ctx.url, ['output']);
    const output = resolveOutput(params, ctx.request, ['md', 'json'], 'md');
    if (output === 'json') return jsonResponse(apiIndex());
    const siteUrl = await ctx.repos.author.siteUrl().catch(() => '');
    return textResponse(renderReadme(readme, { apiBase: ctx.url.origin, siteUrl }), 'md');
}
