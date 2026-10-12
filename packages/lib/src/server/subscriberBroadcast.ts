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

    const claim = db
        .from('db_posts')
        .update({ subscribers_notified_at: new Date().toISOString() })
        .eq('id', postId);
    const { data: claimed, error: claimError } = await (force ?
        claim.select('id')
    :   claim.is('subscribers_notified_at', null).select('id'));
    if (claimError) {
        console.error('Failed to claim post notification:', claimError);
        return { sent: 0, reason: 'unavailable' };
    }
    if (!claimed?.length) return { sent: 0, reason: 'already-sent' };

    const recipients = await activeSubscribers(db);
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

    return { sent: await sendBatch(apiKey, from, mails) };
}
