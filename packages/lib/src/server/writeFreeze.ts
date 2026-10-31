// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { Handle } from '@sveltejs/kit/hooks';
import * as privateEnv from '$app/env/private';
import { apiError } from './apiError';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function writesFrozen(platform?: unknown): boolean {
    const value =
        (platform as { env?: Record<string, unknown> } | undefined)?.env?.WRITES_FROZEN
        ?? (privateEnv as Record<string, string | undefined>).WRITES_FROZEN
        ?? process.env.WRITES_FROZEN;
    return ['1', 'true'].includes(
        String(value ?? '')
            .trim()
            .toLowerCase()
    );
}

export function isFrozenWrite(request: Request, url: URL, platform?: unknown): boolean {
    return (
        !READ_METHODS.has(request.method)
        && url.pathname.startsWith('/api/internal/')
        && writesFrozen(platform)
    );
}

export function frozenWriteResponse(): Response {
    const response = apiError(
        503,
        'MAINTENANCE',
        'Changes are paused for maintenance. Try again in a few minutes.'
    );
    response.headers.set('Retry-After', '60');
    response.headers.set('Cache-Control', 'no-store');
    return response;
}

export const writeFreezeHandle: Handle = ({ event, resolve }) =>
    isFrozenWrite(event.request, event.url, event.platform) ? frozenWriteResponse() : (
        resolve(event)
    );
