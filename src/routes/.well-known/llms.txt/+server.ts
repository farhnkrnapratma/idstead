import type {RequestHandler} from './$types';
import {GET as getLlmsTxt} from '../../llms.txt/+server';

export const GET: RequestHandler = async event => {
  return getLlmsTxt(event);
};
