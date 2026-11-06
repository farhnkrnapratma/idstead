// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { more, sentry, slot, slots } from './support.ts';

const POST_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

const state = {
    notify: { reason: 'sent', sent: 1, failed: 0 } as Record<string, unknown>,
    notifyError: false,
    notified: [] as unknown[][],
    calls: [] as string[],
    failing: new Set<string>(),
    refresh: { failed: 0 } as Record<string, unknown>
};

const service = {
    writers: { newsletter: { marker: 'newsletter' } },
    renders: {},
    adminPosts: {},
    maintenance: {
        pruneLockoutFailures: async () => {
            state.calls.push('lockout');
            if (state.failing.has('lockout')) throw new Error('lockout');
        },
        pruneStaleSubscriptions: async () => {
            state.calls.push('subscriptions');
            if (state.failing.has('subscriptions')) throw new Error('subscriptions');
        },
        pruneActivityLog: async () => void state.calls.push('activity')
    },
    oidcAuth: { prune: async () => void state.calls.push('oidc') }
};

slots.dataStores = () => ({ service });
slots.cleanupBlogAssets = async () => void state.calls.push('blog-assets');
more.cleanupAssets = async () => void state.calls.push('assets');
more.refreshPostRenders = async () => {
    state.calls.push('renders');
    if (state.failing.has('renders')) throw new Error('renders');
    return state.refresh;
};
slot.notifyNewPost = async (...args: unknown[]) => {
    state.notified.push(args);
    if (state.notifyError) throw new Error('send');
    return state.notify;
};
mock.module('../../packages/lib/src/server/mdrsData.ts', () => ({ mdrsResolvers: () => ({}) }));
mock.module('../../packages/lib/src/mdrsOptions.ts', () => ({ siteRenderOptions: () => ({}) }));

const target = '../../apps/jobs/src/index.ts';
const worker = (await import(target)).default as {
    fetch: () => Promise<Response>;
    queue: (batch: any, env: Record<string, unknown>) => Promise<void>;
    scheduled: (controller: any, env: Record<string, unknown>, ctx: any) => Promise<void>;
};
const configsAtLoad = sentry.configs.slice(-2);

interface Fake {
    id: string;
    body: unknown;
    attempts: number;
    acked: boolean;
    retried: unknown;
    ack(): void;
    retry(options: unknown): void;
}

function message(body: unknown): Fake {
    const fake: Fake = {
        id: 'msg-1',
        body,
        attempts: 2,
        acked: false,
        retried: undefined,
        ack: () => {
            fake.acked = true;
        },
        retry: options => {
            fake.retried = options;
        }
    };
    return fake;
}

const batch = (queue: string, ...messages: Fake[]) => ({ queue, messages });

beforeEach(() => {
    state.notify = { reason: 'sent', sent: 1, failed: 0 };
    state.notifyError = false;
    state.notified = [];
    state.calls = [];
    state.failing = new Set();
    state.refresh = { failed: 0 };
    sentry.exceptions.length = 0;
    sentry.messages.length = 0;
});

describe('jobs worker', () => {
    test('configures sentry and rejects direct requests', async () => {
        expect(configsAtLoad[0]).toMatchObject({ dsn: '', environment: 'production' });
        expect(configsAtLoad[1]).toMatchObject({ dsn: 'dsn', environment: 'preview' });
        expect((await worker.fetch()).status).toBe(404);
    });

    test('acknowledges dead-lettered newsletter messages', async () => {
        const valid = message({ postId: POST_ID, force: true });
        const malformed = message('nonsense');
        await worker.queue(batch('idstead-newsletter-dlq', valid, malformed), {});
        expect(valid.acked && malformed.acked).toBe(true);
        expect(sentry.messages).toHaveLength(2);
        expect((sentry.messages[0][1] as any).extra).toMatchObject({
            postId: POST_ID,
            force: true
        });
        expect((sentry.messages[1][1] as any).extra).toMatchObject({ postId: null, force: false });
    });

    test('retries every message while writes are frozen', async () => {
        const held = message({ postId: POST_ID });
        await worker.queue(batch('idstead-newsletter', held), { WRITES_FROZEN: '1' });
        expect(held.retried).toEqual({ delaySeconds: 300 });
        expect(state.notified).toHaveLength(0);
    });

    test('delivers newsletters and maps the outcomes', async () => {
        const sent = message({ postId: POST_ID });
        const forced = message({ postId: POST_ID, force: true });
        const malformed = message({ postId: 'nope' });
        await worker.queue(batch('idstead-newsletter', sent, forced, malformed), {});
        expect(sent.acked && forced.acked && malformed.acked).toBe(true);
        expect(state.notified.map(call => call[3])).toEqual([false, true]);

        state.notify = { reason: 'unavailable' };
        const unavailable = message({ postId: POST_ID });
        await worker.queue(batch('idstead-newsletter', unavailable), {});
        expect(unavailable.retried).toEqual({ delaySeconds: 300 });

        state.notify = { reason: 'send-failed', sent: 1, failed: 2 };
        const failed = message({ postId: POST_ID });
        await worker.queue(batch('idstead-newsletter', failed), {});
        expect(failed.retried).toEqual({ delaySeconds: 300 });
        expect(sentry.messages.at(-1)![0]).toBe('Newsletter send failed');

        state.notifyError = true;
        const thrown = message({ postId: POST_ID });
        await worker.queue(batch('idstead-newsletter', thrown), {});
        expect(thrown.retried).toEqual({ delaySeconds: 300 });
        expect(sentry.exceptions).toHaveLength(1);
    });

    test('refreshes renders for refresh messages and reports failures', async () => {
        const refresh = message({ kind: 'refresh-renders' });
        const other = message({ postId: POST_ID });
        await worker.queue(batch('idstead-renders', refresh, other), {});
        expect(refresh.acked && other.acked).toBe(true);
        expect(state.calls).toEqual(['renders']);

        state.refresh = { failed: 2 };
        const warned = message({ kind: 'refresh-renders' });
        await worker.queue(batch('idstead-renders', warned), {});
        expect(warned.acked).toBe(true);
        expect(sentry.messages.at(-1)![0]).toBe('Post render refresh failed');

        state.failing.add('renders');
        const broken = message({ kind: 'refresh-renders' });
        await worker.queue(batch('idstead-renders', broken), {});
        expect(broken.retried).toEqual({ delaySeconds: 300 });
        expect(sentry.exceptions).toHaveLength(1);
    });

    test('runs the hourly and daily schedules', async () => {
        const waits: Promise<unknown>[] = [];
        const ctx = { waitUntil: (promise: Promise<unknown>) => void waits.push(promise) };
        await worker.scheduled({ cron: '0 * * * *' }, { HOURLY_CRON: '0 * * * *' }, ctx);
        await Promise.all(waits);
        expect(state.calls).toEqual(['lockout']);

        state.failing.add('lockout');
        await worker.scheduled({ cron: '0 * * * *' }, { HOURLY_CRON: '0 * * * *' }, ctx);
        await Promise.all(waits);
        expect(sentry.exceptions).toHaveLength(1);

        state.calls = [];
        state.failing = new Set(['subscriptions', 'renders']);
        await worker.scheduled({ cron: '0 3 * * *' }, { HOURLY_CRON: '0 * * * *' }, ctx);
        await Promise.all(waits);
        expect(state.calls.sort()).toEqual(
            ['activity', 'assets', 'blog-assets', 'oidc', 'renders', 'subscriptions'].sort()
        );
        expect(sentry.exceptions).toHaveLength(3);

        state.calls = [];
        await worker.scheduled({ cron: 'x' }, { WRITES_FROZEN: 'true' }, ctx);
        expect(state.calls).toEqual([]);
    });
});
