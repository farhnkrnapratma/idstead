import type {RequestHandler} from './$types';
import {openapiSpec} from '#lib/openapi.ts';
import {readSiteProfile, publicResponse} from '#lib/server/publicMetadata.ts';

export const GET: RequestHandler = async ({request}) => {
  const profile = await readSiteProfile();
  const spec = {...openapiSpec, servers: [{url: profile.siteUrl}]};
  const response = await publicResponse(
    request,
    JSON.stringify(spec, null, 2),
    'application/json; charset=utf-8'
  );
  response.headers.set('Access-Control-Allow-Origin', '*');
  return response;
};
