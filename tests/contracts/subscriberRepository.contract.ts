// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import type {
    AdminSubscriberStore,
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
    confirmedAt?: string | null;
    createdAt: string;
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
    admin: AdminSubscriberStore;
};

const token = (char: string) => char.repeat(64);
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const MINUTE = 60 * 1000;

const SUBSCRIBER_SEED: SubscriberSeed = {
    subscribers: [
        {
            email: 'zed@example.com',
            status: 'active',
            unsubscribeToken: token('a'),
            confirmedAt: '2026-10-01T01:00:00.000Z',
            createdAt: '2026-10-01T00:00:00.000Z'
        },
        {
            email: 'amy@example.com',
            status: 'active',
            unsubscribeToken: token('b'),
            confirmedAt: '2026-10-02T01:00:00.000Z',
            createdAt: '2026-10-02T00:00:00.000Z'
        },
        {
            email: 'pending@example.com',
            status: 'pending',
            unsubscribeToken: token('c'),
            confirmTokenHash: token('1'),
            confirmSentAt: new Date(Date.now() - MINUTE).toISOString(),
            createdAt: '2026-10-03T00:00:00.000Z'
        },
        {
            email: 'gone_100%@example.com',
            status: 'unsubscribed',
            unsubscribeToken: token('d'),
            confirmedAt: '2026-10-04T01:00:00.000Z',
            createdAt: '2026-10-04T00:00:00.000Z'
        }
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
            expect(await subscribers.request(request('gone_100%@example.com', token('2')))).toBe(
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
            expect(await subscribers.unsubscribeTokenFor('gone_100%@example.com')).toBeNull();
            expect(await subscribers.unsubscribeTokenFor('nobody@example.com')).toBeNull();
        });
    });

    describe(`${name}: AdminSubscriberStore contract`, () => {
        test('lists newest first with search, status filter and pages', async () => {
            const { admin } = factory(SUBSCRIBER_SEED);
            const all = await admin.list({ page: 1, limit: 10 });
            expect(all.total).toBe(4);
            expect(all.items.map(item => item.email)).toEqual([
                'gone_100%@example.com',
                'pending@example.com',
                'amy@example.com',
                'zed@example.com'
            ]);
            expect(Object.keys(all.items[0]).sort()).toEqual([
                'confirmed_at',
                'created_at',
                'email',
                'id',
                'status',
                'unsubscribed_at'
            ]);
            const second = await admin.list({ page: 2, limit: 3 });
            expect(second).toMatchObject({ total: 4, items: [{ email: 'zed@example.com' }] });
            const active = await admin.list({ status: 'active', page: 1, limit: 10 });
            expect(active.items.map(item => item.email)).toEqual([
                'amy@example.com',
                'zed@example.com'
            ]);
            const search = await admin.list({ query: ' AMY ', page: 1, limit: 10 });
            expect(search.items.map(item => item.email)).toEqual(['amy@example.com']);
        });

        test('treats % and _ in a search as literal characters', async () => {
            const { admin } = factory(SUBSCRIBER_SEED);
            const literal = await admin.list({ query: '_100%', page: 1, limit: 10 });
            expect(literal.items.map(item => item.email)).toEqual(['gone_100%@example.com']);
            expect((await admin.list({ query: '%', page: 1, limit: 10 })).total).toBe(1);
            expect((await admin.list({ query: 'a_y', page: 1, limit: 10 })).total).toBe(0);
        });

        test('switches between active and unsubscribed only', async () => {
            const { admin, newsletter } = factory(SUBSCRIBER_SEED);
            const ids = Object.fromEntries(
                (await admin.list({ page: 1, limit: 10 })).items.map(item => [item.email, item.id])
            );
            const off = await admin.setStatus(ids['amy@example.com'], 'unsubscribed');
            expect(off).toMatchObject({ status: 'unsubscribed' });
            expect(off?.unsubscribed_at).not.toBeNull();
            expect(await admin.setStatus(ids['amy@example.com'], 'unsubscribed')).toBeNull();
            const on = await admin.setStatus(ids['gone_100%@example.com'], 'active');
            expect(on).toMatchObject({
                status: 'active',
                unsubscribed_at: null,
                confirmed_at: '2026-10-04T01:00:00.000Z'
            });
            expect(await admin.setStatus(ids['pending@example.com'], 'active')).toBeNull();
            expect(await admin.setStatus(ids['pending@example.com'], 'unsubscribed')).toBeNull();
            expect((await newsletter.recipients()).map(r => r.email)).toEqual([
                'gone_100%@example.com',
                'zed@example.com'
            ]);
        });

        test('reads and deletes by id', async () => {
            const { admin } = factory(SUBSCRIBER_SEED);
            const [first] = (await admin.list({ page: 1, limit: 1 })).items;
            expect(await admin.byId(first.id)).toEqual(first);
            expect(await admin.delete(first.id)).toBe('deleted');
            expect(await admin.delete(first.id)).toBe('not-found');
            expect(await admin.byId(first.id)).toBeNull();
            expect((await admin.list({ page: 1, limit: 10 })).total).toBe(3);
        });
    });

    describe(`${name}: AdminSubscriberStore consent`, () => {
        test('never reactivates an address that unsubscribed before confirming', async () => {
            const { admin, subscribers, newsletter } = factory(SUBSCRIBER_SEED);
            expect(await subscribers.unsubscribe(token('c'))).toBe('unsubscribed');
            const [row] = (await admin.list({ query: 'pending@', page: 1, limit: 1 })).items;
            expect(row).toMatchObject({ status: 'unsubscribed', confirmed_at: null });
            expect(await admin.setStatus(row.id, 'active')).toBeNull();
            expect((await newsletter.recipients()).map(r => r.email)).not.toContain(
                'pending@example.com'
            );
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
