import type {RequestHandler} from './$types';
import {processCvUpload} from '$lib/server/adminCv';
import {apiError} from '$lib/server/apiError';
import {isSameOriginRequest} from '$lib/server/sameOrigin';

export const POST: RequestHandler = async ({
  request,
  platform,
  url,
  getClientAddress
}) => {
  if (!isSameOriginRequest(request, url)) {
    return apiError(403, 'FORBIDDEN', 'Cross-origin requests are forbidden.');
  }

  return processCvUpload(request, platform, getClientAddress);
};
