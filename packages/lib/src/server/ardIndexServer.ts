// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { ArdEntry } from '#lib/server/ard.ts';
import { loadArdIndex } from '#lib/server/ardIndex.ts';
import type { ArdFetcher } from '#lib/server/ardIngestion.ts';
import type { ArdIndexStore } from '@idstead/data';
import { dataStores } from '#lib/server/data.ts';

export class ArdIndexUnavailableError extends Error {
    constructor() {
        super('The ARD registry index is temporarily unavailable.');
    }
}

export function ardIndexUnavailableResponse(): Response {
    return new Response(
        JSON.stringify({
            errorCode: 'INTERNAL_ERROR',
            message: 'The ARD registry index is temporarily unavailable.'
        }),
        {
            status: 503,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'no-store',
                'Retry-After': '60'
            }
        }
    );
}

function indexStore(platform: unknown): ArdIndexStore {
    const store = dataStores(platform).service?.ard;
    if (!store) throw new ArdIndexUnavailableError();
    return store;
}

export async function getArdIndexEntries(
    siteUrl: string,
    platform: unknown,
    fetcher: ArdFetcher
): Promise<ArdEntry[]> {
    try {
        return await loadArdIndex(siteUrl, indexStore(platform), fetcher);
    } catch (error) {
        if (!(error instanceof ArdIndexUnavailableError))
            console.error('ARD registry index refresh failed.', error);
        throw new ArdIndexUnavailableError();
    }
}
