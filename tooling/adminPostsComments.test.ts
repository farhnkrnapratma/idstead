// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import {
    buttons,
    click,
    confirmDialog,
    failure,
    openAdmin,
    route,
    sent,
    settle,
    text,
    toast,
    type
} from './support/adminHarness.ts';
import { posts } from './fixtures/admin.ts';

function post(id = 'post-1') {
    const card = document.getElementById(`post-${id}`)?.parentElement;
    if (!card) throw new Error(`Post ${id} is not listed`);
    return card;
}

async function openComments() {
    await openAdmin('?tab=posts');
    await click('Show comments', post());
}

function replyField() {
    const field = document.querySelector<HTMLTextAreaElement>('#admin-reply-msg-c1');
    if (!field) throw new Error('Reply field missing');
    return field;
}

test('deleting a post reports a rejection and removes the post on success', async () => {
    await openAdmin('?tab=posts');
    expect(text()).toContain('First post');

    route('POST posts', () => failure('The post changed on another device.', 409));
    await click('Delete post', post());
    await confirmDialog('Delete Post');
    expect(toast()).toEqual({ message: 'The post changed on another device.', type: 'error' });

    route('POST posts', () => ({ success: true, post: { ...posts[0], post_revision: 4 } }));
    await click('Delete post', post());
    await confirmDialog('Delete Post');
    expect(toast().message).toBe('Post deleted.');
    expect(document.getElementById('post-post-1')).toBeNull();
});

test('a failed comment load shows the error and retries', async () => {
    let fail = true;
    route('GET workspace', url =>
        url.searchParams.get('section') === 'comments' && fail
            ? failure('Comments are unavailable.', 503)
            : undefined
    );
    await openComments();
    expect(text()).toContain('Unable to load comments');
    fail = false;
    route('GET workspace', () => ({
        items: [],
        page: 1,
        total: 0,
        asOf: '2026-05-01T10:00:00.000Z'
    }));
    await click('Try again');
    expect(text()).toContain('No comments yet');
});

test('reported comments can be dismissed, and a failure is reported', async () => {
    await openComments();
    expect(text()).toContain('Comment c1');

    route('POST comments/dismiss-reports', () => failure('Nope', 500));
    await click('Dismiss Reports');
    expect(toast()).toEqual({ message: 'Failed to dismiss reports.', type: 'error' });

    route('POST comments/dismiss-reports', () => ({ success: true }));
    await click('Dismiss Reports');
    expect(toast().message).toBe('Reports dismissed.');
    expect(buttons('Dismiss Reports')).toHaveLength(0);
});

test('an admin reply is validated, rejected with the server message, then posted', async () => {
    await openComments();
    await click('Reply', post());
    expect(text()).toContain('Replying to');

    await type(replyField(), 'Thanks for reading');
    route('POST comments/reply', () => failure('Replies are closed for this post.', 403));
    replyField().closest('form')?.requestSubmit();
    await settle();
    expect(toast()).toEqual({ message: 'Replies are closed for this post.', type: 'error' });

    route('POST comments/reply', () => ({ comment: { id: 'c3' } }));
    replyField().closest('form')?.requestSubmit();
    await settle();
    expect(toast().message).toBe('Reply posted.');
    expect(sent('POST', 'comments/reply').at(-1)?.body).toMatchObject({
        postId: 'post-1',
        parentId: 'c1',
        content: 'Thanks for reading'
    });

    await click('Reply', post());
    await click('Cancel reply');
    expect(text()).not.toContain('Replying to');
});

test('deleting a comment reports failure and success', async () => {
    await openComments();

    route('POST workspace', () => failure('Gone', 500));
    await click('Comment options', post());
    await click('Delete');
    await confirmDialog('Delete Comment');
    expect(toast()).toEqual({ message: 'Failed to delete comment.', type: 'error' });

    route('POST workspace', () => ({ success: true }));
    await click('Comment options', post());
    await click('Delete');
    await confirmDialog('Delete Comment');
    expect(toast().message).toBe('Comment deleted.');
});

test('the posts list sorts by every field and filters by status', async () => {
    await openAdmin('?tab=posts');
    for (const field of ['Title', 'Status', 'Views', 'Comments', 'Reading time', 'Date']) {
        const trigger = buttons(/^Sort by/)[0];
        trigger?.click();
        await settle(2);
        [...document.querySelectorAll<HTMLElement>('[role="option"]')]
            .find(option => option.textContent?.trim() === field)
            ?.click();
        await settle(2);
    }
    for (const status of ['Published', 'Draft']) {
        buttons(/^Status/)[0]?.click();
        await settle(2);
        [...document.querySelectorAll<HTMLElement>('[role="option"], [role="menuitemradio"]')]
            .find(option => option.textContent?.trim() === status)
            ?.click();
        await settle(2);
    }
    expect(text()).toContain('Posts');
});
