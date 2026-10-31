// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { Actions, PageServerLoad } from './$types';
import { redirect, type Cookies } from '@sveltejs/kit';
import { serviceData } from '#lib/server/repositories.ts';
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

    const subscribers = serviceData(platform)?.writers.subscribers;
    if (!subscribers) return redirectToResult('unavailable');

    let status;
    try {
        status = await subscribers.statusByUnsubscribeToken(token);
    } catch (error) {
        console.error('Failed to look up the unsubscribe token:', error);
        return redirectToResult('unavailable');
    }

    if (!status) return redirectToResult('invalid');
    if (status === 'unsubscribed') return redirectToResult('unsubscribed');

    cookies.set(TOKEN_COOKIE, token, {
        path: '/unsubscribe',
        httpOnly: true,
        secure: url.protocol === 'https:',
        sameSite: 'lax',
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

        const subscribers = serviceData(platform)?.writers.subscribers;
        if (!subscribers) return redirectToResult('unavailable');

        let result;
        try {
            result = await subscribers.unsubscribe(token);
        } catch (error) {
            console.error('Failed to unsubscribe:', error);
            return redirectToResult('unavailable');
        }
        cookies.delete(TOKEN_COOKIE, { path: '/unsubscribe' });
        return redirectToResult(result);
    }
};
