import { adminWorkspace } from '#lib/server/adminWorkspace.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ request, url, platform, getClientAddress }) =>
    adminWorkspace({ request, url, platform, getClientAddress });
export const POST = GET;
