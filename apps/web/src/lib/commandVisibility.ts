// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { page } from '$app/state';
import { isHiddenLegalPath } from './legalVisibility';

const MAILING_COMMAND = '/mailing';
const COOKIES_COMMAND = '/cookies';

export function isHiddenCommand(path: string | undefined): boolean {
    if (!path?.startsWith('/')) return false;
    if (path === MAILING_COMMAND || path.startsWith(`${MAILING_COMMAND} `))
        return !page.data.newsletterEnabled;
    if (path === COOKIES_COMMAND) return !page.data.cookieConsent;
    return isHiddenLegalPath(path);
}
