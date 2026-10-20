import { publicRepositories } from './repositories';
import type { NewsletterRecipient, NewsletterStore } from '@idstead/data';
import { newPostEmail, resendApiKey, sendBatch, senderAddress } from './subscribers';
import { configuredSiteUrl } from './siteUrl';

export type BroadcastOutcome =
    | { sent: number; reason?: undefined }
    | { sent: number; failed: number; reason: 'send-failed' }
    | { sent: 0; reason: 'unpublished' | 'already-sent' | 'no-subscribers' | 'unavailable' };

export async function notifyNewPost(
    newsletter: NewsletterStore,
    platform: unknown,
    postId: string,
    force = false
): Promise<BroadcastOutcome> {
    const apiKey = resendApiKey(platform);
    const from = senderAddress(platform);
    if (!apiKey || !from) return { sent: 0, reason: 'unavailable' };

    const claim = await newsletter.claim(postId, force).catch(error => {
        console.error('Failed to claim post notification:', error);
        return null;
    });
    if (!claim || claim.status === 'not-found') return { sent: 0, reason: 'unavailable' };
    if (claim.status !== 'claimed') return { sent: 0, reason: claim.status };
    const { post } = claim;

    const release = () =>
        claim.release().catch(error => {
            console.error('Failed to release post notification:', error);
        });

    let recipients: NewsletterRecipient[];
    try {
        recipients = await newsletter.recipients();
    } catch (error) {
        console.error('Failed to load subscribers:', error);
        await release();
        return { sent: 0, reason: 'unavailable' };
    }
    if (!recipients.length) return { sent: 0, reason: 'no-subscribers' };

    const profile = await publicRepositories()
        .author.profile()
        .catch(() => null);
    const siteUrl = profile?.siteUrl?.trim().replace(/\/+$/, '') || configuredSiteUrl(platform);
    const siteName = profile?.name?.trim() || new URL(siteUrl).hostname;
    const postUrl = `${siteUrl}/blog/${post.slug}`;

    const mails = recipients.map(recipient => {
        const unsubscribeUrl = `${siteUrl}/unsubscribe?token=${recipient.unsubscribeToken}`;
        return {
            to: recipient.email,
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
        `newsletter/${postId}/${post.previousSentAt ?? 'auto'}`
    );
    if (failed) {
        await release();
        return { sent, failed, reason: 'send-failed' };
    }
    return { sent };
}
