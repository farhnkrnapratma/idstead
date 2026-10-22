import type {
    BroadcastClaim,
    NewsletterStore,
    SubscriberRepository,
    SubscriberStatus,
    SubscriptionRequest
} from '../subscribers';
import { DataError } from '../errors';
import { flag, type D1Like } from './client';

async function guarded<T>(operation: string, task: () => Promise<T>): Promise<T> {
    try {
        return await task();
    } catch (error) {
        throw new DataError(operation, error);
    }
}

export function createD1SubscriberRepository(db: D1Like): SubscriberRepository {
    function statusBy(column: 'unsubscribe_token', value: string, operation: string) {
        return guarded(operation, async () => {
            const row = await db
                .prepare(`SELECT status FROM db_subscribers WHERE ${column} = ?1`)
                .bind(value)
                .first<{ status: SubscriberStatus }>();
            return row?.status ?? null;
        });
    }

    return {
        request(input: SubscriptionRequest) {
            return guarded('subscribers.request', async () => {
                const existing = await db
                    .prepare(
                        'SELECT id, status, confirm_sent_at FROM db_subscribers WHERE email = ?1'
                    )
                    .bind(input.email)
                    .first<{
                        id: string;
                        status: SubscriberStatus;
                        confirm_sent_at: string | null;
                    }>();
                if (existing?.status === 'active') return 'already-active';
                if (
                    existing?.status === 'pending'
                    && existing.confirm_sent_at
                    && Date.now() - new Date(existing.confirm_sent_at).getTime()
                        < input.resendCooldownMs
                )
                    return 'cooling-down';
                const now = new Date().toISOString();
                if (existing)
                    await db
                        .prepare(
                            `UPDATE db_subscribers SET status = 'pending', confirm_token_hash = ?2, confirm_sent_at = ?3,
                             updated_at = ?3, user_agent = ?4, ip_hash = coalesce(?5, ip_hash),
                             unsubscribe_token = CASE WHEN status = 'unsubscribed' THEN ?6 ELSE unsubscribe_token END
                             WHERE id = ?1`
                        )
                        .bind(
                            existing.id,
                            input.confirmTokenHash,
                            now,
                            input.userAgent,
                            input.ipHash,
                            input.unsubscribeToken
                        )
                        .run();
                else
                    await db
                        .prepare(
                            `INSERT INTO db_subscribers (email, status, confirm_token_hash, confirm_sent_at, updated_at, user_agent, ip_hash, unsubscribe_token)
                             VALUES (?1, 'pending', ?2, ?3, ?3, ?4, ?5, ?6)`
                        )
                        .bind(
                            input.email,
                            input.confirmTokenHash,
                            now,
                            input.userAgent,
                            input.ipHash,
                            input.unsubscribeToken
                        )
                        .run();
                return 'requested';
            });
        },

        cancelConfirmation(email: string, confirmTokenHash: string) {
            return guarded('subscribers.cancelConfirmation', async () => {
                await db
                    .prepare(
                        'UPDATE db_subscribers SET confirm_sent_at = NULL WHERE email = ?1 AND confirm_token_hash = ?2'
                    )
                    .bind(email, confirmTokenHash)
                    .run();
            });
        },

        confirm(confirmTokenHash: string) {
            return guarded('subscribers.confirm', async () => {
                const row = await db
                    .prepare('SELECT id, status FROM db_subscribers WHERE confirm_token_hash = ?1')
                    .bind(confirmTokenHash)
                    .first<{ id: string; status: SubscriberStatus }>();
                if (!row) return 'invalid';
                if (row.status === 'active') return 'confirmed';
                const now = new Date().toISOString();
                await db
                    .prepare(
                        `UPDATE db_subscribers SET status = 'active', confirmed_at = ?2, confirm_token_hash = NULL,
                         unsubscribed_at = NULL, updated_at = ?2 WHERE id = ?1`
                    )
                    .bind(row.id, now)
                    .run();
                return 'confirmed';
            });
        },

        statusByUnsubscribeToken(token: string) {
            return statusBy('unsubscribe_token', token, 'subscribers.status');
        },

        unsubscribe(token: string) {
            return guarded('subscribers.unsubscribe', async () => {
                const now = new Date().toISOString();
                const { meta } = await db
                    .prepare(
                        `UPDATE db_subscribers SET status = 'unsubscribed', unsubscribed_at = ?2, confirm_token_hash = NULL,
                         updated_at = ?2 WHERE unsubscribe_token = ?1 AND status <> 'unsubscribed'`
                    )
                    .bind(token, now)
                    .run();
                if (meta.changes > 0) return 'unsubscribed';
                const status = await statusBy(
                    'unsubscribe_token',
                    token,
                    'subscribers.unsubscribe'
                );
                return status === 'unsubscribed' ? 'unsubscribed' : 'invalid';
            });
        },

        unsubscribeTokenFor(email: string) {
            return guarded('subscribers.unsubscribeToken', async () => {
                const row = await db
                    .prepare(
                        'SELECT status, unsubscribe_token FROM db_subscribers WHERE email = ?1'
                    )
                    .bind(email)
                    .first<{ status: SubscriberStatus; unsubscribe_token: string }>();
                return row && row.status !== 'unsubscribed' ? row.unsubscribe_token : null;
            });
        }
    };
}

export function createD1NewsletterStore(db: D1Like): NewsletterStore {
    return {
        claim(postId: string, force: boolean): Promise<BroadcastClaim> {
            return guarded('newsletter.claim', async () => {
                const post = await db
                    .prepare(
                        'SELECT title, slug, excerpt, published, subscribers_notified_at FROM db_posts WHERE id = ?1'
                    )
                    .bind(postId)
                    .first<{
                        title: string;
                        slug: string;
                        excerpt: string | null;
                        published: number;
                        subscribers_notified_at: string | null;
                    }>();
                if (!post) return { status: 'not-found' };
                if (!flag(post.published)) return { status: 'unpublished' };
                if (post.subscribers_notified_at && !force) return { status: 'already-sent' };
                const claimedAt = new Date().toISOString();
                const { meta } = await db
                    .prepare(
                        `UPDATE db_posts SET subscribers_notified_at = ?2
                         WHERE id = ?1${force ? '' : ' AND subscribers_notified_at IS NULL'}`
                    )
                    .bind(postId, claimedAt)
                    .run();
                if (!meta.changes) return { status: 'already-sent' };
                const previousSentAt = post.subscribers_notified_at ?? null;
                return {
                    status: 'claimed',
                    post: {
                        title: post.title,
                        slug: post.slug,
                        excerpt: post.excerpt,
                        previousSentAt
                    },
                    release: () =>
                        guarded('newsletter.release', async () => {
                            await db
                                .prepare(
                                    'UPDATE db_posts SET subscribers_notified_at = ?3 WHERE id = ?1 AND subscribers_notified_at = ?2'
                                )
                                .bind(postId, claimedAt, previousSentAt)
                                .run();
                        })
                };
            });
        },

        recipients() {
            return guarded('newsletter.recipients', async () => {
                const { results } = await db
                    .prepare(
                        "SELECT email, unsubscribe_token FROM db_subscribers WHERE status = 'active' ORDER BY email"
                    )
                    .all<{ email: string; unsubscribe_token: string }>();
                return results.map(row => ({
                    email: row.email,
                    unsubscribeToken: row.unsubscribe_token
                }));
            });
        }
    };
}
