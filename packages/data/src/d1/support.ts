import type { ArdIndexStore } from '../ard';
import type { IdentityVersionReader } from '../identity';
import type { LockoutStore } from '../lockout';
import type { MaintenanceStore } from '../maintenance';
import { DataError } from '../errors';
import type { D1Like } from './client';

const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_ATTEMPTS = 5;
const KEY_HASH = /^[0-9a-f]{64}$/;

function validKeys(keys: string[]): string[] {
    return [...new Set(keys.filter(key => KEY_HASH.test(key)))].slice(0, 10);
}

function placeholders(count: number, start = 1): string {
    return Array.from({ length: count }, (_, index) => `?${index + start}`).join(', ');
}

export function createD1IdentityVersionReader(db: D1Like): IdentityVersionReader {
    return {
        async current() {
            try {
                const row = await db
                    .prepare(
                        'SELECT avatar_version, banner_version FROM db_profiles ORDER BY created_at LIMIT 1'
                    )
                    .first<{ avatar_version: string | null; banner_version: string | null }>();
                return { avatar: row?.avatar_version ?? null, banner: row?.banner_version ?? null };
            } catch (error) {
                throw new DataError('identity.current', error);
            }
        }
    };
}

export function createD1ArdIndexStore(db: D1Like): ArdIndexStore {
    return {
        async read(siteUrl) {
            try {
                const row = await db
                    .prepare('SELECT entries, indexed_at FROM db_ard_index WHERE site_url = ?1')
                    .bind(siteUrl)
                    .first<{ entries: string; indexed_at: string }>();
                return row ? { entries: JSON.parse(row.entries), indexedAt: row.indexed_at } : null;
            } catch (error) {
                throw new DataError('ard.read', error);
            }
        },

        async write(siteUrl, entries, sources, indexedAt) {
            try {
                await db
                    .prepare(
                        `INSERT INTO db_ard_index (site_url, entries, sources, indexed_at) VALUES (?1, ?2, ?3, ?4)
                         ON CONFLICT (site_url) DO UPDATE SET entries = excluded.entries, sources = excluded.sources, indexed_at = excluded.indexed_at`
                    )
                    .bind(siteUrl, JSON.stringify(entries), JSON.stringify(sources), indexedAt)
                    .run();
            } catch (error) {
                throw new DataError('ard.write', error);
            }
        }
    };
}

export function createD1LockoutStore(db: D1Like, now: () => number = Date.now): LockoutStore {
    return {
        async retryAfter(keys) {
            const valid = validKeys(keys);
            if (!valid.length) return 0;
            const current = now();
            try {
                const { results } = await db
                    .prepare(
                        `SELECT min(failed_at) AS oldest FROM db_lockout_failures
                         WHERE key_hash IN (${placeholders(valid.length, 2)}) AND failed_at > ?1
                         GROUP BY key_hash HAVING count(*) >= ${LOCKOUT_ATTEMPTS}`
                    )
                    .bind(new Date(current - LOCKOUT_WINDOW_MS).toISOString(), ...valid)
                    .all<{ oldest: string }>();
                return results.reduce(
                    (wait, row) =>
                        Math.max(
                            wait,
                            1,
                            Math.ceil((Date.parse(row.oldest) + LOCKOUT_WINDOW_MS - current) / 1000)
                        ),
                    0
                );
            } catch (error) {
                throw new DataError('db_lockout_retry_after', error);
            }
        },

        async recordFailure(keys) {
            const valid = validKeys(keys);
            if (!valid.length) return;
            const current = now();
            try {
                await db.batch([
                    db
                        .prepare(
                            `DELETE FROM db_lockout_failures WHERE key_hash IN (${placeholders(valid.length, 2)}) AND failed_at <= ?1`
                        )
                        .bind(new Date(current - LOCKOUT_WINDOW_MS).toISOString(), ...valid),
                    ...valid.map(key =>
                        db
                            .prepare(
                                'INSERT INTO db_lockout_failures (key_hash, failed_at) VALUES (?1, ?2)'
                            )
                            .bind(key, new Date(current).toISOString())
                    )
                ]);
            } catch (error) {
                throw new DataError('db_lockout_record_failure', error);
            }
        },

        async clear(keys) {
            const valid = validKeys(keys);
            if (!valid.length) return;
            try {
                await db
                    .prepare(
                        `DELETE FROM db_lockout_failures WHERE key_hash IN (${placeholders(valid.length)})`
                    )
                    .bind(...valid)
                    .run();
            } catch (error) {
                throw new DataError('db_lockout_clear', error);
            }
        }
    };
}

export function createD1MaintenanceStore(db: D1Like): MaintenanceStore {
    async function prune(operation: string, sql: string) {
        try {
            return (await db.prepare(sql).run()).meta.changes;
        } catch (error) {
            throw new DataError(operation, error);
        }
    }

    return {
        pruneStaleSubscriptions: () =>
            prune(
                'db_prune_stale_subscriptions',
                "DELETE FROM db_subscribers WHERE status = 'pending' AND created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 days')"
            ),
        pruneActivityLog: () =>
            prune(
                'db_prune_activity_log',
                "DELETE FROM db_activity_log WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')"
            ),
        pruneLockoutFailures: () =>
            prune(
                'db_prune_lockout_failures',
                "DELETE FROM db_lockout_failures WHERE failed_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')"
            )
    };
}
