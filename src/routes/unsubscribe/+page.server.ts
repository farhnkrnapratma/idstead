import type {PageServerLoad} from './$types';
import {getSupabaseAdminClient} from '$lib/server/supabaseAdmin';
import {SUBSCRIBER_TABLE} from '$lib/server/subscribers';

export const load: PageServerLoad = async ({url, platform}) => {
  const token = url.searchParams.get('token') ?? '';
  if (!/^[0-9a-f]{64}$/.test(token)) return {state: 'invalid' as const};

  const db = getSupabaseAdminClient(platform);
  if (!db) return {state: 'unavailable' as const};

  const {data: row} = await db
    .from(SUBSCRIBER_TABLE)
    .select('id, status')
    .eq('unsubscribe_token', token)
    .maybeSingle();

  if (!row) return {state: 'invalid' as const};
  if (row.status === 'unsubscribed') return {state: 'unsubscribed' as const};

  const {error} = await db
    .from(SUBSCRIBER_TABLE)
    .update({
      status: 'unsubscribed',
      unsubscribed_at: new Date().toISOString(),
      confirm_token_hash: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', row.id);

  if (error) {
    console.error('Failed to unsubscribe:', error);
    return {state: 'unavailable' as const};
  }
  return {state: 'unsubscribed' as const};
};
