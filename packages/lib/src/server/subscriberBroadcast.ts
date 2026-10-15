import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAuthorProfile } from '#lib/author.ts';
import { supabase as publicSupabase } from '#lib/supabase.ts';
import {
    activeSubscribers,
    newPostEmail,
    resendApiKey,
    sendBatch,
    senderAddress
} from './subscribers';

export type BroadcastOutcome =
    | { sent: number; reason?: undefined }
    | { sent: number; failed: number; reason: 'send-failed' }
    | { sent: 0; reason: 'unpublished' | 'already-sent' | 'no-subscribers' | 'unavailable' };

export async function notifyNewPost(
    db: SupabaseClient,
    platform: unknown,
    origin: string,
    postId: string,
    force = false
): Promise<BroadcastOutcome> {
    const apiKey = resendApiKey(platform);
    const from = senderAddress(platform);
    if (!apiKey || !from) return { sent: 0, reason: 'unavailable' };

    const { data: post, error } = await db
        .from('db_posts')
        .select('id, title, slug, excerpt, published, subscribers_notified_at')
        .eq('id', postId)
        .maybeSingle();
    if (error || !post) return { sent: 0, reason: 'unavailable' };
    if (!post.published) return { sent: 0, reason: 'unpublished' };
    if (post.subscribers_notified_at && !force) return { sent: 0, reason: 'already-sent' };

    const claimedAt = new Date().toISOString();
    const claim = db
        .from('db_posts')
        .update({ subscribers_notified_at: claimedAt })
        .eq('id', postId);
    const { data: claimed, error: claimError } = await (force ?
        claim.select('id')
    :   claim.is('subscribers_notified_at', null).select('id'));
    if (claimError) {
        console.error('Failed to claim post notification:', claimError);
        return { sent: 0, reason: 'unavailable' };
    }
    if (!claimed?.length) return { sent: 0, reason: 'already-sent' };

    const release = async () => {
        const { error: releaseError } = await db
            .from('db_posts')
            .update({ subscribers_notified_at: post.subscribers_notified_at ?? null })
            .eq('id', postId)
            .eq('subscribers_notified_at', claimedAt);
        if (releaseError) console.error('Failed to release post notification:', releaseError);
    };

    const recipients = await activeSubscribers(db);
    if (!recipients) {
        await release();
        return { sent: 0, reason: 'unavailable' };
    }
    if (!recipients.length) return { sent: 0, reason: 'no-subscribers' };

    const profile = await fetchAuthorProfile(publicSupabase);
    const siteUrl = profile?.siteUrl?.trim().replace(/\/+$/, '') || origin;
    const siteName = profile?.name?.trim() || new URL(siteUrl).hostname;
    const postUrl = `${siteUrl}/blog/${post.slug}`;

    const mails = recipients.map(row => {
        const unsubscribeUrl = `${siteUrl}/unsubscribe?token=${row.unsubscribe_token}`;
        return {
            to: row.email,
            unsubscribeUrl,
            ...newPostEmail(
                siteName,
                { title: post.title, excerpt: post.excerpt, url: postUrl },
                unsubscribeUrl
            )
        };
    });

    const { sent, failed } = await sendBatch(
        apiKey,
        from,
        mails,
        `newsletter/${postId}/${post.subscribers_notified_at ?? 'auto'}`
    );
    if (failed) {
        await release();
        return { sent, failed, reason: 'send-failed' };
    }
    return { sent };
}
