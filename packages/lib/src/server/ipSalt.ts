// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import * as privateEnv from '$app/env/private';

export function ipSalt(platform: unknown): string {
    return (
        (platform as { env?: { IP_SALT?: string } } | undefined)?.env?.IP_SALT
        ?? privateEnv.IP_SALT
        ?? process.env.IP_SALT
        ?? ''
    );
}
