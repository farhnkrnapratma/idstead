import {error} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {readSiteProfile, publicResponse} from '#lib/server/publicMetadata.ts';
import {skillDocument} from '#lib/server/apiDiscovery.ts';

export const GET: RequestHandler = async ({params, request}) => {
  const profile = await readSiteProfile();
  const body = skillDocument(params.name, profile.siteUrl);
  if (!body) error(404, 'Skill document not found.');
  const response = await publicResponse(
    request,
    body,
    'text/markdown; charset=utf-8'
  );
  response.headers.set('Access-Control-Allow-Origin', '*');
  return response;
};
