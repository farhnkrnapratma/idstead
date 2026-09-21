import type {PageServerLoad} from './$types';
import {getSupabaseAdminClient} from '$lib/server/supabaseAdmin';
import {SUBSCRIBER_TABLE, hashToken} from '$lib/server/subscribers';

export const load: PageServerLoad = async ({url, platform}) => {
  const token = url.searchParams.get('token') ?? '';
  if (!/^[0-9a-f]{64}$/.test(token)) return {state: 'invalid' as const};

  const db = getSupabaseAdminClient(platform);
  if (!db) return {state: 'unavailable' as const};

  const {data: row} = await db
    .from(SUBSCRIBER_TABLE)
    .select('id, status')
    .eq('confirm_token_hash', await hashToken(token))
    .maybeSingle();

  if (!row) return {state: 'invalid' as const};
  if (row.status === 'active') return {state: 'confirmed' as const};

  const {error} = await db
    .from(SUBSCRIBER_TABLE)
    .update({
      status: 'active',
      confirmed_at: new Date().toISOString(),
      confirm_token_hash: null,
      unsubscribed_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', row.id);

  if (error) {
    console.error('Failed to confirm subscriber:', error);
    return {state: 'unavailable' as const};
  }
  return {state: 'confirmed' as const};
};
