// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { DefineError, renderMarkdown } from '@mdrs/core';
import { adminFetch } from './adminClient';
import * as publicEnv from '$app/env/public';
import { siteRenderOptions } from '#lib/mdrsOptions.ts';

const ENDPOINT = '/api/internal/admin/mdrs-get';
const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; value: Promise<unknown> }>();

async function request(url: string): Promise<unknown> {
    const response = await adminFetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
    }).catch(() => null);
    const body = (await response?.json().catch(() => null)) as {
        data?: unknown;
        error?: { message?: string };
    } | null;
    if (!response?.ok)
        throw new DefineError(body?.error?.message ?? 'get() is unavailable right now.');
    return body?.data;
}

function cached(url: string): Promise<unknown> {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
    const value = request(url);
    cache.set(url, { at: Date.now(), value });
    value.catch(() => cache.delete(url));
    return value;
}

export function renderMdrsPreview(markdown: string): Promise<string> {
    return renderMarkdown(markdown, cached, siteRenderOptions(publicEnv.PUBLIC_SITE_URL));
}
