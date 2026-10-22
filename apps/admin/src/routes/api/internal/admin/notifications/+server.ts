import { adminActivity } from '#lib/server/adminActivity.ts';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = ({ request, url, platform }) =>
    adminActivity({ request, url, platform }, true);
export const POST = GET;
