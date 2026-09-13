import {getSupabaseAdminClient} from '$lib/server/supabaseAdmin';
import {adminWorkspace} from '$lib/server/adminWorkspace';
import type {RequestHandler} from './$types';

export const GET: RequestHandler = ({request, url, platform}) =>
  adminWorkspace({request, url, db: getSupabaseAdminClient(platform)});
export const POST = GET;
