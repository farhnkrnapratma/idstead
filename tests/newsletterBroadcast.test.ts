import { afterEach, describe, expect, mock, test } from 'bun:test';

mock.module('$app/env/public', () => ({}));
mock.module('$app/env/private', () => ({}));

const { notifyNewPost } = await import('../packages/lib/src/server/subscriberBroadcast.ts');
const { createSupabaseNewsletterStore } =
    await import('../packages/data/src/supabase/subscribers.ts');

const POST_ID = '7f3c2a10-4b1d-4c8e-9a2f-0d1e2f3a4b5c';
const platform = { env: { RESEND_API_KEY: 're_test', SUBSCRIBER_FROM_EMAIL: 'news@example.com' } };

type Row = Record<string, unknown>;

function fakeDb(subscriberCount: number, notifiedAt: string | null = null) {
    const post: Row = {
        id: POST_ID,
        title: 'Hello',
        slug: 'hello',
        excerpt: 'Excerpt',
        published: true,
        subscribers_notified_at: notifiedAt
    };
    const subscribers = Array.from({ length: subscriberCount }, (_, i) => ({
        email: `reader${String(i).padStart(3, '0')}@example.com`,
        unsubscribe_token: `token-${i}`
    }));

    function query(table: string) {
        const filters: [string, unknown][] = [];
        let patch: Row | null = null;
        const run = () => {
            if (table === 'db_subscribers') return { data: subscribers, error: null };
            const matches = filters.every(([key, value]) => post[key] === value);
            if (patch) {
                if (!matches) return { data: [], error: null };
                Object.assign(post, patch);
                return { data: [{ id: POST_ID }], error: null };
            }
            return { data: matches ? { ...post } : null, error: null };
        };
        const builder = {
            select: () => builder,
            order: () => builder,
            update: (values: Row) => ((patch = values), builder),
            eq: (key: string, value: unknown) => (filters.push([key, value]), builder),
            is: (key: string, value: unknown) => (filters.push([key, value]), builder),
            maybeSingle: () => Promise.resolve(run()),
            then: (resolve: (value: unknown) => unknown) => Promise.resolve(run()).then(resolve)
        };
        return builder;
    }

    return { db: createSupabaseNewsletterStore({ from: query } as never), post };
}

const realFetch = globalThis.fetch;
const batchCalls: {
    key: string | null;
    size: number;
    body: { text: string; headers?: Record<string, string> }[];
}[] = [];

function stubFetch(failingChunks: Set<number>) {
    batchCalls.length = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url !== 'https://api.resend.com/emails/batch')
            return new Response('{"message":"offline"}', { status: 500 });
        const headers = new Headers(init?.headers);
        const body = JSON.parse(String(init?.body));
        const index =
            batchCalls.push({ key: headers.get('Idempotency-Key'), size: body.length, body }) - 1;
        return failingChunks.has(index) ?
                new Response('{"message":"down"}', { status: 500 })
            :   new Response('{"data":[]}', { status: 200 });
    }) as typeof fetch;
}

afterEach(() => {
    globalThis.fetch = realFetch;
});

describe('notifyNewPost', () => {
    test('keeps the claim when every chunk is sent', async () => {
        const { db, post } = fakeDb(150);
        stubFetch(new Set());
        const result = await notifyNewPost(db, platform, POST_ID);
        expect(result).toEqual({ sent: 150 });
        expect(post.subscribers_notified_at).toBeString();
        expect(batchCalls.map(call => call.size)).toEqual([100, 50]);
    });

    test('releases the claim and reports send-failed when a chunk fails', async () => {
        const { db, post } = fakeDb(150);
        stubFetch(new Set([1]));
        const result = await notifyNewPost(db, platform, POST_ID);
        expect(result).toEqual({ sent: 100, failed: 50, reason: 'send-failed' });
        expect(post.subscribers_notified_at).toBeNull();
    });

    test('sends the same idempotency keys when a failed broadcast is retried', async () => {
        const { db } = fakeDb(150);
        stubFetch(new Set([1]));
        await notifyNewPost(db, platform, POST_ID);
        const firstKeys = batchCalls.map(call => call.key);
        stubFetch(new Set());
        await notifyNewPost(db, platform, POST_ID);
        expect(batchCalls.map(call => call.key)).toEqual(firstKeys);
        expect(firstKeys[0]).toStartWith(`newsletter/${POST_ID}/auto/`);
        expect(new Set(firstKeys).size).toBe(2);
    });

    test('a forced re-send retried after a failure reuses its keys and restores the old timestamp', async () => {
        const previous = '2026-10-01T00:00:00.000Z';
        const { db, post } = fakeDb(150, previous);
        stubFetch(new Set([1]));
        await notifyNewPost(db, platform, POST_ID, true);
        expect(post.subscribers_notified_at).toBe(previous);
        const firstKeys = batchCalls.map(call => call.key);
        stubFetch(new Set());
        await notifyNewPost(db, platform, POST_ID, true);
        expect(batchCalls.map(call => call.key)).toEqual(firstKeys);
        expect(firstKeys[0]).toStartWith(`newsletter/${POST_ID}/${previous}/`);
    });

    test('links to PUBLIC_SITE_URL, never the calling host, when the profile has no site URL', async () => {
        const { db } = fakeDb(1);
        stubFetch(new Set());
        await notifyNewPost(
            db,
            { env: { ...platform.env, PUBLIC_SITE_URL: 'https://site.example/' } },
            POST_ID
        );
        expect(batchCalls[0].body[0].text).toContain('https://site.example/blog/hello');
        expect(batchCalls[0].body[0].text).toContain(
            'https://site.example/unsubscribe?token=token-0'
        );
    });

    test('lists the confirm page as the unsubscribe link without promising a one-click POST', async () => {
        const { db } = fakeDb(1);
        stubFetch(new Set());
        await notifyNewPost(
            db,
            { env: { ...platform.env, PUBLIC_SITE_URL: 'https://site.example' } },
            POST_ID
        );
        expect(batchCalls[0].body[0].headers).toEqual({
            'List-Unsubscribe': '<https://site.example/unsubscribe?token=token-0>'
        });
    });
});
