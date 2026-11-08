// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, expect, mock, test } from 'bun:test';

const state = {
    newsletter: true as boolean | Error,
    render: true as boolean | Error,
    broadcast: null as Error | null,
    calls: [] as string[]
};

mock.module('../packages/lib/src/server/newsletterQueue.ts', () => ({
    enqueueNewsletter: async () => {
        state.calls.push('newsletter');
        if (state.newsletter instanceof Error) throw state.newsletter;
        return state.newsletter;
    }
}));
mock.module('../packages/lib/src/server/renderQueue.ts', () => ({
    enqueueRenderRefresh: async () => {
        state.calls.push('render');
        if (state.render instanceof Error) throw state.render;
        return state.render;
    }
}));
mock.module('../packages/lib/src/server/subscriberBroadcast.ts', () => ({
    notifyNewPost: async () => {
        state.calls.push('broadcast');
        if (state.broadcast) throw state.broadcast;
    }
}));
mock.module('../packages/lib/src/server/workerEnv.ts', () => ({
    runInBackground: async (task: Promise<unknown>) => {
        state.calls.push('background');
        await task;
    }
}));

const { queuePostEffects } = await import('../packages/lib/src/server/postEffects.ts');

const realError = console.error;
let logged: unknown[][] = [];
const newsletter = {} as never;
const input = (published: boolean, wasPublished: boolean) => ({
    postId: 'p1',
    published,
    wasPublished
});

beforeEach(() => {
    state.newsletter = true;
    state.render = true;
    state.broadcast = null;
    state.calls = [];
    logged = [];
    console.error = (...args: unknown[]) => void logged.push(args);
});

afterEach(() => {
    console.error = realError;
});

test('queues the broadcast and a render refresh when a post is published', async () => {
    await queuePostEffects(newsletter, undefined, input(true, false));
    expect(state.calls).toEqual(['newsletter', 'render']);
});

test('refreshes renders without a broadcast when an unpublished post was published before', async () => {
    await queuePostEffects(newsletter, undefined, input(false, true));
    expect(state.calls).toEqual(['render']);
});

test('does nothing for a draft that was never published', async () => {
    await queuePostEffects(newsletter, undefined, input(false, false));
    expect(state.calls).toEqual([]);
});

test('sends the broadcast in the background when the newsletter queue is unavailable', async () => {
    state.newsletter = false;
    await queuePostEffects(newsletter, undefined, input(true, false));
    expect(state.calls).toEqual(['newsletter', 'broadcast', 'background', 'render']);
});

test('reports broadcast and render queue failures without throwing', async () => {
    state.newsletter = new Error('queue down');
    state.broadcast = new Error('send failed');
    state.render = new Error('render down');
    await queuePostEffects(newsletter, undefined, input(true, true));
    expect(state.calls).toEqual(['newsletter', 'broadcast', 'background', 'render']);
    expect(logged.map(args => String(args[0]))).toEqual([
        'Could not queue the subscriber broadcast:',
        'Subscriber broadcast failed:',
        'Could not queue the post render refresh:'
    ]);
});
