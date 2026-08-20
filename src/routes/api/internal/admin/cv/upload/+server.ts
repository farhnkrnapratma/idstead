import type {RequestHandler} from './$types';
import {processCvUpload} from '$lib/server/adminCv';

export const POST: RequestHandler = async ({request, platform}) => {
  return processCvUpload(request, platform);
};
