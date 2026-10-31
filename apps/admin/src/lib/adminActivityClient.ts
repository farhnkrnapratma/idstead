// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { adminRequest } from './adminClient';

export function adminActivityRequest<T>(
    path: 'notifications' | 'activity' | 'workspace',
    params: Record<string, string> = {},
    body?: unknown,
    signal?: AbortSignal
): Promise<T> {
    return adminRequest<T>(path, {
        params,
        body,
        signal,
        fallbackMessage: 'Activity is temporarily unavailable.'
    });
}
