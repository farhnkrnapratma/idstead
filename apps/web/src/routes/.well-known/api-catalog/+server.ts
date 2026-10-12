import type { RequestHandler } from './$types';
import * as publicEnv from '$app/env/public';
import { apiUrl } from '#lib/apiConfig.ts';
import { readSiteProfile, publicResponse } from '#lib/server/publicMetadata.ts';
import { discoveryOperations } from '#lib/server/apiDiscovery.ts';

export const GET: RequestHandler = async ({ request }) => {
    const { siteUrl: base } = await readSiteProfile();
    const apiBase = publicEnv.PUBLIC_API_BASE_URL;
    const catalog = {
        linkset: [
            {
                anchor: apiUrl('', apiBase),
                'service-desc': [
                    { href: apiUrl('/openapi.json', apiBase), type: 'application/json' },
                    { href: apiUrl('/openapi.yaml', apiBase), type: 'application/yaml' }
                ],
                'service-doc': [{ href: apiUrl('', apiBase), type: 'text/markdown' }],
                describedby: [
                    {
                        href: `${base}/.well-known/agent-skills/index.json`,
                        type: 'application/json'
                    }
                ],
                item: discoveryOperations(apiBase)
                    .filter(operation => !operation.path.includes('{'))
                    .map(operation => ({ href: operation.url, title: operation.description }))
            }
        ]
    };
    const response = await publicResponse(
        request,
        JSON.stringify(catalog),
        'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"'
    );
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
};
