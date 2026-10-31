// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    enqueueNewsletter,
    isNewsletterMessage
} from '../packages/lib/src/server/newsletterQueue.ts';

const POST_ID = '7f3c2a10-4b1d-4c8e-9a2f-0d1e2f3a4b5c';

describe('newsletter queue messages', () => {
    test('accepts a post id with an optional force flag', () => {
        expect(isNewsletterMessage({ postId: POST_ID })).toBe(true);
        expect(isNewsletterMessage({ postId: POST_ID, force: true })).toBe(true);
    });

    test('rejects malformed messages', () => {
        expect(isNewsletterMessage(null)).toBe(false);
        expect(isNewsletterMessage({ postId: 'not-a-uuid' })).toBe(false);
        expect(isNewsletterMessage({ postId: POST_ID, force: 'yes' })).toBe(false);
    });

    test('reports that nothing was queued without a queue binding', async () => {
        expect(await enqueueNewsletter({ postId: POST_ID })).toBe(false);
    });
});
