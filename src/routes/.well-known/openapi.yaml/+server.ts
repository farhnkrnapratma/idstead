import type {RequestHandler} from './$types';
import {openapiSpec} from '$lib/openapi';
import {readSiteProfile, publicResponse} from '$lib/server/publicMetadata';
import {stringify} from 'yaml';

export const GET: RequestHandler = async ({request}) => {
  const profile = await readSiteProfile();
  const spec = {...openapiSpec, servers: [{url: profile.siteUrl}]};
  const response = await publicResponse(
    request,
    stringify(spec),
    'application/yaml; charset=utf-8'
  );
  response.headers.set('Access-Control-Allow-Origin', '*');
  return response;
};
