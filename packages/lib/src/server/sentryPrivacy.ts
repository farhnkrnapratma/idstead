// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { httpServerIntegration, requestDataIntegration } from '@sentry/cloudflare';

export function privateRequestIntegrations() {
    return [
        httpServerIntegration({ maxRequestBodySize: 'none' }),
        requestDataIntegration({ include: { data: false } })
    ];
}
