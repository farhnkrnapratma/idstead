// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { ResultCache } from '@idstead/data';

type NamedCaches = { open(name: string): Promise<Cache> };

export function workersResultCache(name = 'idstead-data'): ResultCache | null {
    const storage = (globalThis as { caches?: NamedCaches }).caches;
    if (!storage || typeof storage.open !== 'function') return null;
    let opened: Promise<Cache> | undefined;
    const cache = () => (opened ??= storage.open(name));
    return {
        async get(key) {
            const response = await (await cache()).match(key);
            return response ? response.json() : undefined;
        },
        async put(key, value, ttlSeconds) {
            await (
                await cache()
            ).put(
                key,
                new Response(JSON.stringify(value), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': `public, max-age=${ttlSeconds}`
                    }
                })
            );
        }
    };
}
