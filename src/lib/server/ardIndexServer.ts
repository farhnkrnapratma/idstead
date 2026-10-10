import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import type { ArdEntry } from '#lib/server/ard.ts';
import { loadArdIndex, type ArdIndexStore } from '#lib/server/ardIndex.ts';

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

    return {
        async read(siteUrl) {
            const { data, error } = await client
                .from('db_ard_index')
                .select('entries,indexed_at')
                .eq('site_url', siteUrl)
                .maybeSingle();
            if (error) throw new Error('ARD index storage read failed.', { cause: error });
            if (!data) return null;
            return { entries: data.entries, indexedAt: data.indexed_at };
        },
        async write(siteUrl, entries, sources, indexedAt) {
            const { error } = await client
                .from('db_ard_index')
                .upsert({ site_url: siteUrl, entries, sources, indexed_at: indexedAt });
            if (error) throw new Error('ARD index storage write failed.', { cause: error });
        }
    };
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
