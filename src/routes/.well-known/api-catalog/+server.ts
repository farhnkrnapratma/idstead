import type {RequestHandler} from './$types';
import {readSiteProfile, publicResponse} from '$lib/server/publicMetadata';
import {discoveryOperations} from '$lib/server/apiDiscovery';

export const GET: RequestHandler = async ({request}) => {
  const {siteUrl: base} = await readSiteProfile();
  const catalog = {
    linkset: [
      {
        anchor: `${base}/api/v1`,
        'service-desc': [
          {href: `${base}/.well-known/openapi.json`, type: 'application/json'},
          {href: `${base}/.well-known/openapi.yaml`, type: 'application/yaml'}
        ],
        'service-doc': [{href: `${base}/api/v1/docs`, type: 'text/markdown'}],
        describedby: [
          {
            href: `${base}/.well-known/agent-skills/index.json`,
            type: 'application/json'
          }
        ],
        item: discoveryOperations()
          .filter(operation => !operation.path.includes('{'))
          .map(operation => ({
            href: base + operation.path,
            title: operation.description
          }))
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
