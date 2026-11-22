// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { SubscriberRepository, SubscriptionResult } from '@idstead/data';
import { publicRepositories } from './repositories';
import {
    confirmEmail,
    createToken,
    hashToken,
    resendApiKey,
    sendEmail,
    senderAddress
} from './subscribers';

const CONFIRM_RESEND_COOLDOWN_MS = 5 * 60 * 1000;

export type SubscriptionOutcome =
    | SubscriptionResult
    | 'unavailable'
    | 'record-failed'
    | 'send-failed';

export async function requestSubscription(
    subscribers: SubscriberRepository,
    platform: unknown,
    input: { email: string; siteOrigin: string; userAgent: string; ipHash: string | null }
): Promise<SubscriptionOutcome> {
    const apiKey = resendApiKey(platform);
    const from = senderAddress(platform);
    if (!apiKey || !from) return 'unavailable';

    const confirmToken = createToken();
    const confirmTokenHash = await hashToken(confirmToken);
    let result: SubscriptionResult;
    try {
        result = await subscribers.request({
            email: input.email,
            confirmTokenHash,
            unsubscribeToken: createToken(),
            userAgent: input.userAgent.slice(0, 300),
            ipHash: input.ipHash,
            resendCooldownMs: CONFIRM_RESEND_COOLDOWN_MS
        });
    } catch (error) {
        console.error('Failed to record subscriber:', error);
        return 'record-failed';
    }
    if (result !== 'requested') return result;

    const profile = await publicRepositories()
        .author.profile()
        .catch(() => null);
    const siteName = profile?.name?.trim() || new URL(input.siteOrigin).hostname;
    const confirmUrl = `${input.siteOrigin}/subscribe/confirm?token=${confirmToken}`;
    const sent = await sendEmail(apiKey, from, {
        to: input.email,
        ...confirmEmail(siteName, confirmUrl)
    });
    if (!sent) {
        await subscribers.cancelConfirmation(input.email, confirmTokenHash).catch(error => {
            console.error('Failed to reset the confirmation cooldown:', error);
        });
        return 'send-failed';
    }
    return 'requested';
}
