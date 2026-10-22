import { adminWorkspace } from '#lib/server/adminWorkspace.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ request, url, platform }) =>
    adminWorkspace({ request, url, platform });
export const POST = GET;
