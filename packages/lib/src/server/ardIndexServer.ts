import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import type { ArdEntry } from '#lib/server/ard.ts';
import { loadArdIndex } from '#lib/server/ardIndex.ts';
import { createSupabaseArdIndexStore, type ArdIndexStore } from '@idstead/data';

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

function supabaseIndexStore(platform: unknown): ArdIndexStore {
    const client = getSupabaseAdminClient(platform);
    if (!client) throw new ArdIndexUnavailableError();
    return createSupabaseArdIndexStore(client);
}

export async function getArdIndexEntries(siteUrl: string, platform: unknown): Promise<ArdEntry[]> {
    try {
        return await loadArdIndex(siteUrl, supabaseIndexStore(platform));
    } catch (error) {
        if (!(error instanceof ArdIndexUnavailableError))
            console.error('ARD registry index refresh failed.', error);
        throw new ArdIndexUnavailableError();
    }
}
