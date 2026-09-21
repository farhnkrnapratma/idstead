const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED_KEYS = 10000;

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
  if (!record) return {allowed: true, retryAfterSeconds: 0};

  pruneOld(record, now);
  if (record.failures.length < MAX_ATTEMPTS)
    return {allowed: true, retryAfterSeconds: 0};

  return {
    allowed: false,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((record.failures[0] + WINDOW_MS - now) / 1000)
    )
  };
}

export function checkLoginLockout(...keys: string[]): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  evictExpired(now);

  let worst = {allowed: true, retryAfterSeconds: 0};
  for (const key of keys) {
    if (!key) continue;
    const result = checkKey(key, now);
    if (!result.allowed && result.retryAfterSeconds > worst.retryAfterSeconds)
      worst = result;
  }
  return worst;
}

export function recordFailedLogin(...keys: string[]) {
  const now = Date.now();
  evictExpired(now);
  for (const key of keys) {
    if (!key) continue;
    if (attempts.size >= MAX_TRACKED_KEYS && !attempts.has(key)) continue;
    const record = attempts.get(key) || {failures: []};
    pruneOld(record, now);
    record.failures.push(now);
    attempts.set(key, record);
  }
}

export function clearLoginAttempts(...keys: string[]) {
  for (const key of keys) if (key) attempts.delete(key);
}
