import type {RequestHandler} from './$types';
import {processCvGenerate} from '$lib/server/adminCv';

export const POST: RequestHandler = async ({request, platform}) => {
  return processCvGenerate(request, platform);
};
