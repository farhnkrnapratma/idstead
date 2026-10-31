// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import * as publicEnv from '$app/env/public';

export function cdnBaseUrl() {
    return String(publicEnv.PUBLIC_CDN_BASE_URL ?? '')
        .trim()
        .replace(/\/+$/, '');
}
