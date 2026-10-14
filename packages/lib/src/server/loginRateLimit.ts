const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED_KEYS = 10000;

interface LockoutResult {
    allowed: boolean;
    retryAfterSeconds: number;
}

interface LockoutDb {
    rpc: (
        fn: string,
        args: Record<string, unknown>
    ) => PromiseLike<{ data: unknown; error: unknown }>;
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

async function sharedCall(db: LockoutDb | null, fn: string, keys: string[], salt: string) {
    if (!db || !keys.some(Boolean)) return { ok: false as const };
    try {
        const { data, error } = await db.rpc(fn, { p_keys: await hashKeys(keys, salt) });
        if (error) throw error;
        return { ok: true as const, data };
    } catch (error) {
        console.error(`Login lockout ${fn} failed; using the in-memory counter:`, error);
        return { ok: false as const };
    }
}

export async function checkLoginLockout(
    db: LockoutDb | null,
    salt: string,
    ...keys: string[]
): Promise<LockoutResult> {
    const shared = await sharedCall(db, 'db_login_lockout', keys, salt);
    if (!shared.ok || typeof shared.data !== 'number') return memoryLockout(keys);
    return shared.data > 0 ?
            { allowed: false, retryAfterSeconds: shared.data }
        :   { allowed: true, retryAfterSeconds: 0 };
}

export async function recordFailedLogin(db: LockoutDb | null, salt: string, ...keys: string[]) {
    if (!(await sharedCall(db, 'db_login_record_failure', keys, salt)).ok)
        memoryRecordFailure(keys);
}

export async function clearLoginAttempts(db: LockoutDb | null, salt: string, ...keys: string[]) {
    memoryClear(keys);
    await sharedCall(db, 'db_login_clear', keys, salt);
}
