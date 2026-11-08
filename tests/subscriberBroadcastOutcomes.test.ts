// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import { notifyNewPost } from '../packages/lib/src/server/subscriberBroadcast.ts';

const platform = {
    env: { RESEND_API_KEY: 'key', SUBSCRIBER_FROM_EMAIL: 'Site <site@example.com>' }
};
const postId = '0f8fad5b-d9cb-469f-a165-70867728950e';

function newsletter(overrides: Record<string, unknown> = {}) {
    let released = 0;
    const store = {
        claim: async () => ({
            status: 'claimed',
            post: { id: postId, title: 'Hello', slug: 'hello', excerpt: 'Hi' },
            release: async () => {
                released++;
            }
        }),
        recipients: async () => [],
        ...overrides
    };
    return { store: store as never, released: () => released };
}

test('reports why a post was not sent when the claim is unavailable or already used', async () => {
    expect(
        await notifyNewPost(
            newsletter({ claim: async () => ({ status: 'not-found' }) }).store,
            platform,
            postId
        )
    ).toEqual({ sent: 0, reason: 'unavailable' });
    expect(
        await notifyNewPost(
            newsletter({
                claim: async () => {
                    throw new Error('db');
                }
            }).store,
            platform,
            postId
        )
    ).toEqual({ sent: 0, reason: 'unavailable' });
    expect(
        await notifyNewPost(
            newsletter({ claim: async () => ({ status: 'already-sent' }) }).store,
            platform,
            postId
        )
    ).toEqual({ sent: 0, reason: 'already-sent' });
});

test('releases the claim when subscribers cannot be loaded and skips empty lists', async () => {
    const failing = newsletter({
        recipients: async () => {
            throw new Error('db');
        }
    });
    expect(await notifyNewPost(failing.store, platform, postId)).toEqual({
        sent: 0,
        reason: 'unavailable'
    });
    expect(failing.released()).toBe(1);

    expect(await notifyNewPost(newsletter().store, platform, postId)).toEqual({
        sent: 0,
        reason: 'no-subscribers'
    });
});
