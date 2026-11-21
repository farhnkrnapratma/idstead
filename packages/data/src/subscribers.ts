// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export type SubscriberStatus = 'pending' | 'active' | 'unsubscribed';

export interface SubscriptionRequest {
    email: string;
    confirmTokenHash: string;
    unsubscribeToken: string;
    userAgent: string;
    ipHash: string | null;
    resendCooldownMs: number;
}

export type SubscriptionResult = 'requested' | 'already-active' | 'cooling-down';

export interface SubscriberRepository {
    request(input: SubscriptionRequest): Promise<SubscriptionResult>;
    cancelConfirmation(email: string, confirmTokenHash: string): Promise<void>;
    confirm(confirmTokenHash: string): Promise<'confirmed' | 'invalid'>;
    statusByUnsubscribeToken(token: string): Promise<SubscriberStatus | null>;
    unsubscribe(token: string): Promise<'unsubscribed' | 'invalid'>;
    unsubscribeTokenFor(email: string): Promise<string | null>;
}

export interface NewsletterRecipient {
    email: string;
    unsubscribeToken: string;
}

export interface BroadcastPost {
    title: string;
    slug: string;
    excerpt: string | null;
    previousSentAt: string | null;
}

export type BroadcastClaim =
    | { status: 'claimed'; post: BroadcastPost; release(): Promise<void> }
    | { status: 'not-found' | 'unpublished' | 'already-sent' };

export interface NewsletterStore {
    claim(postId: string, force: boolean): Promise<BroadcastClaim>;
    recipients(): Promise<NewsletterRecipient[]>;
}

export interface AdminSubscriber {
    id: string;
    email: string;
    status: SubscriberStatus;
    created_at: string;
    confirmed_at: string | null;
    unsubscribed_at: string | null;
}

export interface AdminSubscriberQuery {
    query?: string;
    status?: SubscriberStatus;
    page: number;
    limit: number;
}

export interface AdminSubscriberStore {
    list(query: AdminSubscriberQuery): Promise<{ items: AdminSubscriber[]; total: number }>;
    byId(id: string): Promise<AdminSubscriber | null>;
    setStatus(id: string, status: 'active' | 'unsubscribed'): Promise<AdminSubscriber | null>;
    delete(id: string): Promise<'deleted' | 'not-found'>;
}
