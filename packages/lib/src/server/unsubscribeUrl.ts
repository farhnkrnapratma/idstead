// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export type UnsubscribeState = 'confirm' | 'invalid' | 'unavailable' | 'unsubscribed';

export function unsubscribeResultUrl(url: URL, state: UnsubscribeState): string {
    const cleanUrl = new URL(url);
    cleanUrl.searchParams.delete('token');
    cleanUrl.searchParams.set('state', state);
    return `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`;
}
