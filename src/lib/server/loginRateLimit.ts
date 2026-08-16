const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

interface AttemptRecord {
  failures: number[]
}

const attempts = new Map<string, AttemptRecord>()

function pruneOld(record: AttemptRecord, now: number) {
  record.failures = record.failures.filter(t => now - t < WINDOW_MS)
}

export function checkLoginLockout(key: string): {
  allowed: boolean
  retryAfterSeconds: number
} {
  const now = Date.now()
  const record = attempts.get(key)
  if (!record) return {allowed: true, retryAfterSeconds: 0}

  pruneOld(record, now)
  if (record.failures.length < MAX_ATTEMPTS) {
    return {allowed: true, retryAfterSeconds: 0}
  }

  const oldest = record.failures[0]
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((oldest + WINDOW_MS - now) / 1000)
  )
  return {allowed: false, retryAfterSeconds}
}

export function recordFailedLogin(key: string) {
  const now = Date.now()
  const record = attempts.get(key) || {failures: []}
  pruneOld(record, now)
  record.failures.push(now)
  attempts.set(key, record)
}

export function clearLoginAttempts(key: string) {
  attempts.delete(key)
}
