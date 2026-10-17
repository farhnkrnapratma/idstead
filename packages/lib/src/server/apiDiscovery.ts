import { openapiSpec } from '#lib/openapi.ts';
import { apiBaseUrl } from '#lib/apiConfig.ts';

export interface DiscoveryOperation {
    name: string;
    path: string;
    url: string;
    description: string;
    mediaType: string;
}

export function discoveryOperations(apiBase?: string | null): DiscoveryOperation[] {
    const origin = apiBaseUrl(apiBase);
    return Object.entries(openapiSpec.paths).flatMap(([path, methods]) => {
        if (!('get' in methods)) return [];
        const operation = methods.get as {
            summary?: string;
            description?: string;
            responses?: Record<string, { content?: Record<string, unknown> } | undefined>;
        };
        if (!operation.responses?.['200']) return [];
        const mediaType = Object.keys(operation.responses?.['200']?.content ?? {})[0];
        const name =
            path
                .replace(/^\/v1\/?/, '')
                .replaceAll('/', '-')
                .replace(/[{}]/g, '')
                .replaceAll('_', '-')
                .toLowerCase() || 'api';
        return [
            {
                name,
                path,
                url: `${origin}${path}`,
                description: operation.summary || operation.description || `Read ${name}.`,
                mediaType: mediaType ?? 'application/json'
            } satisfies DiscoveryOperation
        ];
    });
}
