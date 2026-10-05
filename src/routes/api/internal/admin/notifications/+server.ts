import {getSupabaseAdminClient} from '$lib/server/supabaseAdmin';
import {adminActivity} from '$lib/server/adminActivity';
import type {RequestHandler} from './$types';
export const GET: RequestHandler = ({request, url, platform}) =>
  adminActivity({request, url, db: getSupabaseAdminClient(platform)}, true);
export const POST = GET;
