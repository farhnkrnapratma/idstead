import type {RequestHandler} from './$types';
import {getSupabaseAdminClient} from '$lib/server/supabaseAdmin';
import {SUBSCRIBER_TABLE} from '$lib/server/subscribers';

export const POST: RequestHandler = async ({url, platform}) => {
  const token = url.searchParams.get('token') ?? '';
  if (!/^[0-9a-f]{64}$/.test(token)) return new Response(null, {status: 204});

  const db = getSupabaseAdminClient(platform);
  if (db) {
    const {error} = await db
      .from(SUBSCRIBER_TABLE)
      .update({
        status: 'unsubscribed',
        unsubscribed_at: new Date().toISOString(),
        confirm_token_hash: null,
        updated_at: new Date().toISOString()
      })
      .eq('unsubscribe_token', token)
      .neq('status', 'unsubscribed');
    if (error) console.error('One-click unsubscribe failed:', error);
  }
  return new Response(null, {status: 204});
};
