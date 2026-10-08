import type {RequestHandler} from './$types';
import {createArdManifest} from '#lib/server/ard.ts';
import {readSiteProfile, publicResponse} from '#lib/server/publicMetadata.ts';

export const GET: RequestHandler = async ({request}) => {
  const profile = await readSiteProfile();
  const response = await publicResponse(
    request,
    JSON.stringify(createArdManifest(profile.siteUrl), null, 2),
    'application/json; charset=utf-8'
  );
  response.headers.set('Access-Control-Allow-Origin', '*');
  return response;
};
