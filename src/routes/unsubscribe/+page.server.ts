import type {PageServerLoad} from './$types';
import {redirect} from '@sveltejs/kit';
import {getSupabaseAdminClient} from '#lib/server/supabaseAdmin.ts';
import {SUBSCRIBER_TABLE} from '#lib/server/subscribers.ts';
import {
  unsubscribeResultUrl,
  type UnsubscribeState
} from '#lib/server/unsubscribeUrl.ts';

export const load: PageServerLoad = async ({url, platform}) => {
  const hasToken = url.searchParams.has('token');
  const token = url.searchParams.get('token') ?? '';
  if (!hasToken) {
    const state = url.searchParams.get('state');
    if (
      state === 'invalid'
      || state === 'unavailable'
      || state === 'unsubscribed'
    )
      return {state};

    return {state: 'invalid' as const};
  }

  const redirectToResult = (state: UnsubscribeState): never =>
    redirect(303, unsubscribeResultUrl(url, state));

  if (!/^[0-9a-f]{64}$/.test(token)) return redirectToResult('invalid');

  const db = getSupabaseAdminClient(platform);
  if (!db) return redirectToResult('unavailable');

  const {data: row} = await db
    .from(SUBSCRIBER_TABLE)
    .select('id, status')
    .eq('unsubscribe_token', token)
    .maybeSingle();

  if (!row) return redirectToResult('invalid');
  if (row.status === 'unsubscribed') return redirectToResult('unsubscribed');

  const {data: updatedRow, error} = await db
    .from(SUBSCRIBER_TABLE)
    .update({
      status: 'unsubscribed',
      unsubscribed_at: new Date().toISOString(),
      confirm_token_hash: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', row.id)
    .eq('unsubscribe_token', token)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Failed to unsubscribe:', error);
    return redirectToResult('unavailable');
  }
  if (!updatedRow) return redirectToResult('invalid');
  return redirectToResult('unsubscribed');
};
