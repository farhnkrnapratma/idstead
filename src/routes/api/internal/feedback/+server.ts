import {env} from '$env/dynamic/private';
import {getSupabaseAdminClient} from '$lib/server/supabaseAdmin';
import {recordPageFeedback} from '$lib/server/pageFeedback';
import type {RequestHandler} from './$types';

export const POST: RequestHandler = ({
  request,
  url,
  platform,
  getClientAddress
}) =>
  recordPageFeedback({
    request,
    url,
    db: getSupabaseAdminClient(platform),
    ip: getClientAddress,
    secret:
      typeof platform?.env?.IP_SALT === 'string' ?
        platform.env.IP_SALT
      : env.IP_SALT
  });
