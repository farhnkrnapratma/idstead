import { openapiSpec } from '#lib/openapi.ts';
import type { ApiContext } from './blog';
import { parseApiParams, resolveOutput } from './params';
import { jsonResponse, textResponse } from './responses';

type Operation = { summary?: string; parameters?: Array<{ name?: string }> };

export function apiIndex() {
    return {
        name: openapiSpec.info.title,
        version: openapiSpec.info.version,
        docs: '/api/v1',
        openapi: '/.well-known/openapi.json',
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

export async function getRoot(ctx: ApiContext, readme: string) {
    const params = parseApiParams(ctx.url, ['output']);
    const output = resolveOutput(params, ctx.request, ['md', 'json'], 'md');
    return output === 'json' ? jsonResponse(apiIndex()) : textResponse(readme, 'md');
}
