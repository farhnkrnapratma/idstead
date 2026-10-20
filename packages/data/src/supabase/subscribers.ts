import type { SupabaseClient } from '@supabase/supabase-js';
import type {
    BroadcastClaim,
    NewsletterStore,
    SubscriberRepository,
    SubscriberStatus,
    SubscriptionRequest
} from '../subscribers';
import { DataError } from '../errors';

const SUBSCRIBERS = 'db_subscribers';

export function createSupabaseSubscriberRepository(db: SupabaseClient): SubscriberRepository {
    async function statusBy(column: string, value: string, operation: string) {
        const { data, error } = await db
            .from(SUBSCRIBERS)
            .select('status')
            .eq(column, value)
            .maybeSingle();
        if (error) throw new DataError(operation, error);
        return ((data as { status?: SubscriberStatus } | null)?.status
            ?? null) as SubscriberStatus | null;
    }

    return {
        async request(input: SubscriptionRequest) {
            const { data, error } = await db
                .from(SUBSCRIBERS)
                .select('id, status, confirm_sent_at')
                .eq('email', input.email)
                .maybeSingle();
            if (error) throw new DataError('subscribers.request.lookup', error);
            const existing = data as {
                id: string;
                status: SubscriberStatus;
                confirm_sent_at: string | null;
            } | null;
            if (existing?.status === 'active') return 'already-active';
            if (
                existing?.status === 'pending'
                && existing.confirm_sent_at
                && Date.now() - new Date(existing.confirm_sent_at).getTime()
                    < input.resendCooldownMs
            )
                return 'cooling-down';
            const now = new Date().toISOString();
            const row = {
                email: input.email,
                status: 'pending' as const,
                confirm_token_hash: input.confirmTokenHash,
                confirm_sent_at: now,
                updated_at: now,
                user_agent: input.userAgent,
                ...(existing?.status === 'unsubscribed' ?
                    { unsubscribe_token: input.unsubscribeToken }
                :   {}),
                ...(input.ipHash ? { ip_hash: input.ipHash } : {})
            };
            const { error: writeError } =
                existing ?
                    await db.from(SUBSCRIBERS).update(row).eq('id', existing.id)
                :   await db
                        .from(SUBSCRIBERS)
                        .insert({ ...row, unsubscribe_token: input.unsubscribeToken });
            if (writeError) throw new DataError('subscribers.request', writeError);
            return 'requested';
        },

        async cancelConfirmation(email: string, confirmTokenHash: string) {
            const { error } = await db
                .from(SUBSCRIBERS)
                .update({ confirm_sent_at: null })
                .eq('email', email)
                .eq('confirm_token_hash', confirmTokenHash);
            if (error) throw new DataError('subscribers.cancelConfirmation', error);
        },

        async confirm(confirmTokenHash: string) {
            const { data, error } = await db
                .from(SUBSCRIBERS)
                .select('id, status')
                .eq('confirm_token_hash', confirmTokenHash)
                .maybeSingle();
            if (error) throw new DataError('subscribers.confirm.lookup', error);
            const row = data as { id: string; status: SubscriberStatus } | null;
            if (!row) return 'invalid';
            if (row.status === 'active') return 'confirmed';
            const now = new Date().toISOString();
            const { error: updateError } = await db
                .from(SUBSCRIBERS)
                .update({
                    status: 'active',
                    confirmed_at: now,
                    confirm_token_hash: null,
                    unsubscribed_at: null,
                    updated_at: now
                })
                .eq('id', row.id);
            if (updateError) throw new DataError('subscribers.confirm', updateError);
            return 'confirmed';
        },

        statusByUnsubscribeToken(token: string) {
            return statusBy('unsubscribe_token', token, 'subscribers.status');
        },

        async unsubscribe(token: string) {
            const now = new Date().toISOString();
            const { data, error } = await db
                .from(SUBSCRIBERS)
                .update({
                    status: 'unsubscribed',
                    unsubscribed_at: now,
                    confirm_token_hash: null,
                    updated_at: now
                })
                .eq('unsubscribe_token', token)
                .neq('status', 'unsubscribed')
                .select('id')
                .maybeSingle();
            if (error) throw new DataError('subscribers.unsubscribe', error);
            if (data) return 'unsubscribed';
            const status = await statusBy('unsubscribe_token', token, 'subscribers.unsubscribe');
            return status === 'unsubscribed' ? 'unsubscribed' : 'invalid';
        },

        async unsubscribeTokenFor(email: string) {
            const { data, error } = await db
                .from(SUBSCRIBERS)
                .select('status, unsubscribe_token')
                .eq('email', email)
                .maybeSingle();
            if (error) throw new DataError('subscribers.unsubscribeToken', error);
            const row = data as { status: SubscriberStatus; unsubscribe_token: string } | null;
            return row && row.status !== 'unsubscribed' ? row.unsubscribe_token : null;
        }
    };
}

export function createSupabaseNewsletterStore(db: SupabaseClient): NewsletterStore {
    return {
        async claim(postId: string, force: boolean): Promise<BroadcastClaim> {
            const { data, error } = await db
                .from('db_posts')
                .select('title, slug, excerpt, published, subscribers_notified_at')
                .eq('id', postId)
                .maybeSingle();
            if (error) throw new DataError('newsletter.claim.lookup', error);
            const post = data as {
                title: string;
                slug: string;
                excerpt: string | null;
                published: boolean;
                subscribers_notified_at: string | null;
            } | null;
            if (!post) return { status: 'not-found' };
            if (!post.published) return { status: 'unpublished' };
            if (post.subscribers_notified_at && !force) return { status: 'already-sent' };

            const claimedAt = new Date().toISOString();
            const claim = db
                .from('db_posts')
                .update({ subscribers_notified_at: claimedAt })
                .eq('id', postId);
            const { data: claimed, error: claimError } = await (force ?
                claim.select('id')
            :   claim.is('subscribers_notified_at', null).select('id'));
            if (claimError) throw new DataError('newsletter.claim', claimError);
            if (!claimed?.length) return { status: 'already-sent' };

            const previousSentAt = post.subscribers_notified_at ?? null;
            return {
                status: 'claimed',
                post: { title: post.title, slug: post.slug, excerpt: post.excerpt, previousSentAt },
                async release() {
                    const { error: releaseError } = await db
                        .from('db_posts')
                        .update({ subscribers_notified_at: previousSentAt })
                        .eq('id', postId)
                        .eq('subscribers_notified_at', claimedAt);
                    if (releaseError) throw new DataError('newsletter.release', releaseError);
                }
            };
        },

        async recipients() {
            const { data, error } = await db
                .from(SUBSCRIBERS)
                .select('email, unsubscribe_token')
                .eq('status', 'active')
                .order('email', { ascending: true });
            if (error) throw new DataError('newsletter.recipients', error);
            return ((data ?? []) as { email: string; unsubscribe_token: string }[]).map(row => ({
                email: row.email,
                unsubscribeToken: row.unsubscribe_token
            }));
        }
    };
}
