import { describe, expect, test } from 'bun:test';
import type {
    NewsletterStore,
    SubscriberRepository,
    SubscriberStatus
} from '../../packages/data/src/index.ts';

interface SeedSubscriber {
    email: string;
    status: SubscriberStatus;
    unsubscribeToken: string;
    confirmTokenHash?: string | null;
    confirmSentAt?: string | null;
}

interface SeedBroadcastPost {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    published: boolean;
    sentAt: string | null;
}

export interface SubscriberSeed {
    subscribers: SeedSubscriber[];
    posts: SeedBroadcastPost[];
}

export type SubscriberStoresFactory = (seed: SubscriberSeed) => {
    subscribers: SubscriberRepository;
    newsletter: NewsletterStore;
};

const token = (char: string) => char.repeat(64);
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const MINUTE = 60 * 1000;

const SUBSCRIBER_SEED: SubscriberSeed = {
    subscribers: [
        { email: 'zed@example.com', status: 'active', unsubscribeToken: token('a') },
        { email: 'amy@example.com', status: 'active', unsubscribeToken: token('b') },
        {
            email: 'pending@example.com',
            status: 'pending',
            unsubscribeToken: token('c'),
            confirmTokenHash: token('1'),
            confirmSentAt: new Date(Date.now() - MINUTE).toISOString()
        },
        { email: 'gone@example.com', status: 'unsubscribed', unsubscribeToken: token('d') }
    ],
    posts: [
        {
            id: uuid(1),
            title: 'Fresh',
            slug: 'fresh',
            excerpt: 'New',
            published: true,
            sentAt: null
        },
        {
            id: uuid(2),
            title: 'Draft',
            slug: 'draft',
            excerpt: null,
            published: false,
            sentAt: null
        },
        {
            id: uuid(3),
            title: 'Sent',
            slug: 'sent',
            excerpt: null,
            published: true,
            sentAt: '2026-10-01T00:00:00.000Z'
        }
    ]
};

const request = (email: string, confirmTokenHash: string, overrides = {}) => ({
    email,
    confirmTokenHash,
    unsubscribeToken: token('f'),
    userAgent: 'test',
    ipHash: null,
    resendCooldownMs: 5 * MINUTE,
    ...overrides
});

export function subscriberRepositoryContract(name: string, factory: SubscriberStoresFactory) {
    describe(`${name}: SubscriberRepository contract`, () => {
        test('requests a new subscription and confirms it once', async () => {
            const { subscribers, newsletter } = factory(SUBSCRIBER_SEED);
            expect(await subscribers.request(request('new@example.com', token('2')))).toBe(
                'requested'
            );
            expect(await subscribers.statusByUnsubscribeToken(token('f'))).toBe('pending');
            expect(await subscribers.confirm(token('2'))).toBe('confirmed');
            expect(await subscribers.confirm(token('2'))).toBe('invalid');
            expect((await newsletter.recipients()).map(r => r.email)).toContain('new@example.com');
        });

        test('leaves active subscribers alone and throttles confirmation emails', async () => {
            const { subscribers } = factory(SUBSCRIBER_SEED);
            expect(await subscribers.request(request('amy@example.com', token('2')))).toBe(
                'already-active'
            );
            expect(await subscribers.request(request('pending@example.com', token('2')))).toBe(
                'cooling-down'
            );
            expect(
                await subscribers.request(
                    request('pending@example.com', token('2'), { resendCooldownMs: 0 })
                )
            ).toBe('requested');
            expect(await subscribers.confirm(token('1'))).toBe('invalid');
            expect(await subscribers.confirm(token('2'))).toBe('confirmed');
        });

        test('cancelling a confirmation lifts the cooldown', async () => {
            const { subscribers } = factory(SUBSCRIBER_SEED);
            await subscribers.cancelConfirmation('pending@example.com', token('1'));
            expect(await subscribers.request(request('pending@example.com', token('2')))).toBe(
                'requested'
            );
        });

        test('gives a returning subscriber a fresh unsubscribe token', async () => {
            const { subscribers } = factory(SUBSCRIBER_SEED);
            expect(await subscribers.request(request('gone@example.com', token('2')))).toBe(
                'requested'
            );
            expect(await subscribers.statusByUnsubscribeToken(token('d'))).toBeNull();
            expect(await subscribers.statusByUnsubscribeToken(token('f'))).toBe('pending');
        });

        test('unsubscribes by token idempotently', async () => {
            const { subscribers, newsletter } = factory(SUBSCRIBER_SEED);
            expect(await subscribers.statusByUnsubscribeToken(token('a'))).toBe('active');
            expect(await subscribers.unsubscribe(token('a'))).toBe('unsubscribed');
            expect(await subscribers.unsubscribe(token('a'))).toBe('unsubscribed');
            expect(await subscribers.unsubscribe(token('9'))).toBe('invalid');
            expect(await subscribers.statusByUnsubscribeToken(token('9'))).toBeNull();
            expect((await newsletter.recipients()).map(r => r.email)).toEqual(['amy@example.com']);
        });

        test('hands out unsubscribe tokens only for live subscriptions', async () => {
            const { subscribers } = factory(SUBSCRIBER_SEED);
            expect(await subscribers.unsubscribeTokenFor('zed@example.com')).toBe(token('a'));
            expect(await subscribers.unsubscribeTokenFor('pending@example.com')).toBe(token('c'));
            expect(await subscribers.unsubscribeTokenFor('gone@example.com')).toBeNull();
            expect(await subscribers.unsubscribeTokenFor('nobody@example.com')).toBeNull();
        });
    });

    describe(`${name}: NewsletterStore contract`, () => {
        test('lists active recipients by email', async () => {
            const { newsletter } = factory(SUBSCRIBER_SEED);
            expect(await newsletter.recipients()).toEqual([
                { email: 'amy@example.com', unsubscribeToken: token('b') },
                { email: 'zed@example.com', unsubscribeToken: token('a') }
            ]);
        });

        test('claims a published post once until the claim is released', async () => {
            const { newsletter } = factory(SUBSCRIBER_SEED);
            const claim = await newsletter.claim(uuid(1), false);
            expect(claim.status).toBe('claimed');
            if (claim.status !== 'claimed') return;
            expect(claim.post).toEqual({
                title: 'Fresh',
                slug: 'fresh',
                excerpt: 'New',
                previousSentAt: null
            });
            expect((await newsletter.claim(uuid(1), false)).status).toBe('already-sent');
            await claim.release();
            expect((await newsletter.claim(uuid(1), false)).status).toBe('claimed');
        });

        test('refuses drafts and unknown posts', async () => {
            const { newsletter } = factory(SUBSCRIBER_SEED);
            expect(await newsletter.claim(uuid(2), false)).toEqual({ status: 'unpublished' });
            expect(await newsletter.claim(uuid(9), true)).toEqual({ status: 'not-found' });
        });

        test('a forced re-send restores the previous timestamp on release', async () => {
            const { newsletter } = factory(SUBSCRIBER_SEED);
            expect((await newsletter.claim(uuid(3), false)).status).toBe('already-sent');
            const claim = await newsletter.claim(uuid(3), true);
            expect(claim.status === 'claimed' && claim.post.previousSentAt).toBe(
                '2026-10-01T00:00:00.000Z'
            );
            if (claim.status === 'claimed') await claim.release();
            const again = await newsletter.claim(uuid(3), true);
            expect(again.status === 'claimed' && again.post.previousSentAt).toBe(
                '2026-10-01T00:00:00.000Z'
            );
        });
    });
}
