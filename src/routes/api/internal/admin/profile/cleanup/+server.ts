import * as Sentry from '@sentry/sveltekit';
import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {requireAdminAuth} from '#lib/server/adminCv.ts';
import {cleanupAssets} from '#lib/server/profileAssets.ts';
import {isSameOriginRequest} from '#lib/server/sameOrigin.ts';
import {apiError} from '#lib/server/apiError.ts';

export const POST: RequestHandler = async ({request, platform, url}) => {
  if (!isSameOriginRequest(request, url))
    return apiError(
      403,
      'PROFILE_ORIGIN_FORBIDDEN',
      'Cross-origin requests are forbidden.'
    );
  const failure = await requireAdminAuth(request, platform);
  if (failure) return failure;
  try {
    return json(
      {removed: await cleanupAssets(platform)},
      {headers: {'Cache-Control': 'no-store'}}
    );
  } catch (error) {
    Sentry.captureException(error);
    return apiError(
      503,
      'PROFILE_CLEANUP_PENDING',
      'Unused image cleanup is pending. Please retry.'
    );
  }
};
