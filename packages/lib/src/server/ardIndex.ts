import { normalizeArdEntry, type ArdEntry } from '#lib/server/ard.ts';
import { crawlArdSources, type ArdFetcher } from '#lib/server/ardIngestion.ts';
import type { ArdIndexStore } from '@idstead/data';

const INDEX_TTL_MS = 5 * 60 * 1000;

export interface ArdIndexCache {
    entries: Map<string, { entries: ArdEntry[]; expiresAt: number }>;
    pending: Map<string, Promise<ArdEntry[]>>;
}

export function createArdIndexCache(): ArdIndexCache {
    return { entries: new Map(), pending: new Map() };
}

const defaultCache = createArdIndexCache();

function normalizedEntries(value: unknown): ArdEntry[] {
    if (!Array.isArray(value)) throw new Error('Stored ARD entries must be an array.');
    const entries: (ArdEntry | undefined)[] = value.map(normalizeArdEntry);
    if (
        entries.some(entry => entry === undefined)
        || new Set(entries.map(entry => entry?.identifier)).size !== entries.length
    )
        throw new Error('Stored ARD entries are invalid or duplicated.');
    return entries.filter((entry): entry is ArdEntry => entry !== undefined);
}

export async function loadArdIndex(
    siteUrl: string,
    store: ArdIndexStore,
    fetcher: ArdFetcher = fetch,
    cache: ArdIndexCache = defaultCache,
    now: () => number = Date.now
): Promise<ArdEntry[]> {
    const origin = new URL(siteUrl).origin;
    const memory = cache.entries.get(origin);
    if (memory && memory.expiresAt > now()) return memory.entries;

    const existing = cache.pending.get(origin);
    if (existing) return existing;

    const pending = (async () => {
        const stored = await store.read(origin);
        if (stored) {
            const entries = normalizedEntries(stored.entries);
            const indexedAt = Date.parse(stored.indexedAt);
            const expiresAt = indexedAt + INDEX_TTL_MS;
            if (Number.isFinite(indexedAt) && indexedAt <= now() && expiresAt > now()) {
                cache.entries.set(origin, { entries, expiresAt });
                return entries;
            }
        }

        const snapshot = await crawlArdSources(origin, fetcher);
        const indexedAt = new Date(now()).toISOString();
        await store.write(origin, snapshot.entries, snapshot.sources, indexedAt);
        if (snapshot.warnings.length > 0)
            console.warn('ARD ingestion completed with warnings.', snapshot.warnings);
        cache.entries.set(origin, { entries: snapshot.entries, expiresAt: now() + INDEX_TTL_MS });
        return snapshot.entries;
    })();
    cache.pending.set(origin, pending);

    try {
        return await pending;
    } finally {
        if (cache.pending.get(origin) === pending) cache.pending.delete(origin);
    }
}
