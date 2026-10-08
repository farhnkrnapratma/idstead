import {getSupabaseAdminClient} from '#lib/server/supabaseAdmin.ts';
import {adminActivity} from '#lib/server/adminActivity.ts';
import type {RequestHandler} from './$types';
export const GET: RequestHandler = ({request, url, platform}) =>
  adminActivity({request, url, db: getSupabaseAdminClient(platform)}, false);
