import type { Actions, PageServerLoad } from './$types';
import { redirect, type Cookies } from '@sveltejs/kit';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { SUBSCRIBER_TABLE } from '#lib/server/subscribers.ts';
import { unsubscribeResultUrl, type UnsubscribeState } from '#lib/server/unsubscribeUrl.ts';

const TOKEN_COOKIE = 'unsubscribe_token';
const TOKEN_RE = /^[0-9a-f]{64}$/;

function storedToken(cookies: Cookies): string {
    const token = cookies.get(TOKEN_COOKIE) ?? '';
    return TOKEN_RE.test(token) ? token : '';
}

export const load: PageServerLoad = async ({ url, platform, cookies }) => {
    const hasToken = url.searchParams.has('token');
    const token = url.searchParams.get('token') ?? '';
    if (!hasToken) {
        const state = url.searchParams.get('state');
        if (state === 'confirm') return { state: storedToken(cookies) ? state : 'invalid' };
        if (state === 'invalid' || state === 'unavailable' || state === 'unsubscribed')
            return { state };

        return { state: 'invalid' as const };
    }

    const redirectToResult = (state: UnsubscribeState): never =>
        redirect(303, unsubscribeResultUrl(url, state));

    if (!TOKEN_RE.test(token)) return redirectToResult('invalid');

    const db = getSupabaseAdminClient(platform);
    if (!db) return redirectToResult('unavailable');

    const { data: row } = await db
        .from(SUBSCRIBER_TABLE)
        .select('id, status')
        .eq('unsubscribe_token', token)
        .maybeSingle();

    if (!row) return redirectToResult('invalid');
    if (row.status === 'unsubscribed') return redirectToResult('unsubscribed');

    cookies.set(TOKEN_COOKIE, token, {
        path: '/unsubscribe',
        httpOnly: true,
        secure: url.protocol === 'https:',
        sameSite: 'strict',
        maxAge: 60 * 60
    });
    return redirectToResult('confirm');
};

export const actions: Actions = {
    default: async ({ url, platform, cookies }) => {
        const redirectToResult = (state: UnsubscribeState): never =>
            redirect(303, unsubscribeResultUrl(url, state));

        const token = storedToken(cookies);
        if (!token) return redirectToResult('invalid');

        const db = getSupabaseAdminClient(platform);
        if (!db) return redirectToResult('unavailable');

        const { data: updatedRow, error } = await db
            .from(SUBSCRIBER_TABLE)
            .update({
                status: 'unsubscribed',
                unsubscribed_at: new Date().toISOString(),
                confirm_token_hash: null,
                updated_at: new Date().toISOString()
            })
            .eq('unsubscribe_token', token)
            .neq('status', 'unsubscribed')
            .select('id')
            .maybeSingle();

        if (error) {
            console.error('Failed to unsubscribe:', error);
            return redirectToResult('unavailable');
        }
        cookies.delete(TOKEN_COOKIE, { path: '/unsubscribe' });
        if (!updatedRow) {
            const { data: row } = await db
                .from(SUBSCRIBER_TABLE)
                .select('status')
                .eq('unsubscribe_token', token)
                .maybeSingle();
            return redirectToResult(row?.status === 'unsubscribed' ? 'unsubscribed' : 'invalid');
        }
        return redirectToResult('unsubscribed');
    }
};
