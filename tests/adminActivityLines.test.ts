// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';

const ActivitySentence = (
    (await import('../apps/admin/src/lib/components/admin/ActivitySentence.svelte')) as {
        default: never;
    }
).default;
const ActivityDetails = (
    (await import('../apps/admin/src/lib/components/admin/ActivityDetails.svelte')) as {
        default: never;
    }
).default;

const mounted: object[] = [];

const settle = async () => {
    for (let round = 0; round < 4; round++) {
        await tick();
        await new Promise(resolve => setTimeout(resolve, 0));
        flushSync();
    }
};

afterEach(() => {
    for (const instance of mounted.splice(0)) {
        try {
            void unmount(instance);
        } catch {}
    }
    document.body.innerHTML = '';
});

function row(kind: string, extra: Record<string, unknown> = {}) {
    return {
        id: 'n1',
        kind,
        created_at: '2026-01-02T03:04:05.000Z',
        page_title: 'Hello world',
        page_type: 'article',
        page_slug: 'hello',
        report_status: 'open',
        meta: {},
        ...extra
    };
}

async function show(component: unknown, props: Record<string, unknown>) {
    mounted.push(mount(component as never, { target: document.body, props: props as never }));
    await settle();
    return document.body.textContent ?? '';
}

test('activity sentences describe each notification kind', async () => {
    const text = await show(ActivitySentence, {
        item: row('comment_report', { meta: { author: 'Ada', reason: 'spam' } })
    });
    expect(text).toContain('Someone reported a comment by');
    expect(text).toContain('Ada');
});

test('activity sentences describe feedback votes and new comments', async () => {
    document.body.innerHTML = '';
    const helpful = await show(ActivitySentence, {
        item: row('post_feedback', { meta: { vote: 'yes' } })
    });
    expect(helpful).toContain('helpful');
    document.body.innerHTML = '';
    const unhelpful = await show(ActivitySentence, {
        item: row('legal_feedback', { page_type: 'legal', meta: { vote: 'no' } })
    });
    expect(unhelpful).toContain('unhelpful');
    document.body.innerHTML = '';
    const comment = await show(ActivitySentence, {
        item: row('comment_new', { meta: { author: 'Grace' } })
    });
    expect(comment).toContain('commented on the');
});

test('activity sentences fall back to contact and feedback wording', async () => {
    document.body.innerHTML = '';
    const contact = await show(ActivitySentence, { item: row('contact_message') });
    expect(contact).toContain('contact form');
});

test('activity details show the reason, comment or fallback message', async () => {
    document.body.innerHTML = '';
    const report = await show(ActivityDetails, {
        item: row('comment_report', { report_status: 'resolved', meta: { reason: 'spam' } }),
        withAuthor: true
    });
    expect(report).toContain('Reported a comment by');
    expect(report).toContain('Resolved');
    document.body.innerHTML = '';
    const reportReason = await show(ActivityDetails, {
        item: row('comment_report', { meta: { reason: 'spam' } })
    });
    expect(reportReason).toContain('Reason');
    document.body.innerHTML = '';
    const comment = await show(ActivityDetails, {
        item: row('comment_new', { meta: { comment: 'Nice post', author: 'Ada' } }),
        withAuthor: true
    });
    expect(comment).toContain('commented');
    document.body.innerHTML = '';
    const feedback = await show(ActivityDetails, {
        item: row('post_feedback', { meta: { vote: 'no' } }),
        withAuthor: true
    });
    expect(feedback).toContain('Marked this article as unhelpful');
    document.body.innerHTML = '';
    const contact = await show(ActivityDetails, { item: row('contact_message'), withAuthor: true });
    expect(contact).toContain('contact form');
    document.body.innerHTML = '';
    const fallback = await show(ActivityDetails, { item: row('contact_message') });
    expect(fallback).toContain('Check your email inbox.');
});
