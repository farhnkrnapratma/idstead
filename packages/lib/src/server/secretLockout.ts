import type { LockoutStore } from '@idstead/data';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED_KEYS = 10000;

interface LockoutResult {
    allowed: boolean;
    retryAfterSeconds: number;
}

interface AttemptRecord {
    failures: number[];
}

const attempts = new Map<string, AttemptRecord>();

function pruneOld(record: AttemptRecord, now: number) {
    record.failures = record.failures.filter(t => now - t < WINDOW_MS);
}

function evictExpired(now: number) {
    for (const [key, record] of attempts) {
        pruneOld(record, now);
        if (!record.failures.length) attempts.delete(key);
    }
}

function checkKey(key: string, now: number) {
    const record = attempts.get(key);
    if (!record) return { allowed: true, retryAfterSeconds: 0 };

    pruneOld(record, now);
    if (record.failures.length < MAX_ATTEMPTS) return { allowed: true, retryAfterSeconds: 0 };

    return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((record.failures[0] + WINDOW_MS - now) / 1000))
    };
}

function memoryLockout(keys: string[]): LockoutResult {
    const now = Date.now();
    evictExpired(now);

    let worst: LockoutResult = { allowed: true, retryAfterSeconds: 0 };
    for (const key of keys) {
        if (!key) continue;
        const result = checkKey(key, now);
        if (!result.allowed && result.retryAfterSeconds > worst.retryAfterSeconds) worst = result;
    }
    return worst;
}

function memoryRecordFailure(keys: string[]) {
    const now = Date.now();
    evictExpired(now);
    for (const key of keys) {
        if (!key) continue;
        if (attempts.size >= MAX_TRACKED_KEYS && !attempts.has(key)) continue;
        const record = attempts.get(key) || { failures: [] };
        pruneOld(record, now);
        record.failures.push(now);
        attempts.set(key, record);
    }
}

function memoryClear(keys: string[]) {
    for (const key of keys) if (key) attempts.delete(key);
}

async function hashKeys(keys: string[], salt: string): Promise<string[]> {
    return Promise.all(
        [...new Set(keys.filter(Boolean))].map(async key => {
            const digest = await crypto.subtle.digest(
                'SHA-256',
                new TextEncoder().encode(key + salt)
            );
            return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join(
                ''
            );
        })
    );
}

async function sharedCall<T>(
    store: LockoutStore | null,
    keys: string[],
    salt: string,
    run: (store: LockoutStore, hashed: string[]) => Promise<T>
) {
    if (!store || !keys.some(Boolean)) return { ok: false as const };
    try {
        return { ok: true as const, data: await run(store, await hashKeys(keys, salt)) };
    } catch (error) {
        console.error('Lockout storage failed; using the in-memory counter:', error);
        return { ok: false as const };
    }
}

export async function checkLockout(
    store: LockoutStore | null,
    salt: string,
    ...keys: string[]
): Promise<LockoutResult> {
    const shared = await sharedCall(store, keys, salt, (s, hashed) => s.retryAfter(hashed));
    if (!shared.ok) return memoryLockout(keys);
    return shared.data > 0 ?
            { allowed: false, retryAfterSeconds: shared.data }
        :   { allowed: true, retryAfterSeconds: 0 };
}

export async function recordLockoutFailure(
    store: LockoutStore | null,
    salt: string,
    ...keys: string[]
) {
    const shared = await sharedCall(store, keys, salt, (s, hashed) => s.recordFailure(hashed));
    if (!shared.ok) memoryRecordFailure(keys);
}

export async function clearLockout(store: LockoutStore | null, salt: string, ...keys: string[]) {
    memoryClear(keys);
    await sharedCall(store, keys, salt, (s, hashed) => s.clear(hashed));
}
