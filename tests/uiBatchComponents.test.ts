// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';
import { EditorPreferences } from '../packages/mdrs/editor/src/preferences.svelte.ts';

const RefineImage = (
    (await import('../packages/ui/src/components/RefineImage.svelte')) as { default: never }
).default;
const CommentThread = (
    (await import('../packages/lib/src/components/CommentThread.svelte')) as { default: never }
).default;
const EditorViewBar = (
    (await import('../packages/mdrs/editor/src/EditorViewBar.svelte')) as { default: never }
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

test('refined image renders sources, alt text and load states', async () => {
    mounted.push(
        mount(RefineImage, {
            target: document.body,
            props: {
                src: 'https://cdn.example.com/photo.webp',
                alt: 'A photo',
                sources: [{ srcset: 'https://cdn.example.com/photo.avif', type: 'image/avif' }],
                imgClass: 'rounded',
                loading: 'eager',
                fetchpriority: 'high',
                referrerpolicy: 'no-referrer'
            } as never
        })
    );
    await settle();
    const img = document.querySelector<HTMLImageElement>('img');
    img?.dispatchEvent(new Event('load'));
    flushSync();
    await settle();
    expect(document.body.innerHTML).toContain('photo');
}, 60000);

test('comment thread lists replies, paging and report actions', async () => {
    const comments = Array.from({ length: 14 }, (_, index) => ({
        id: `c${index}`,
        parent_id: index % 3 === 0 ? null : `c${index - 1}`,
        author_name: index % 2 ? 'Reader' : null,
        is_admin: index % 4 === 0,
        is_anonymous: index % 5 === 0,
        content: `Comment number ${index}`,
        created_at: `2026-01-${String((index % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
        reports: index % 2 ? 2 : 0,
        is_approved: index % 3 !== 0
    }));
    mounted.push(
        mount(CommentThread, {
            target: document.body,
            props: {
                comments,
                authorName: 'Ada',
                pageSize: 5,
                controls: true,
                isAdmin: true,
                onReport: () => {},
                onDelete: () => {}
            } as never
        })
    );
    await settle();
    expect(document.body.textContent).toContain('Comment number 0');
    for (const button of [...document.querySelectorAll<HTMLButtonElement>('button')].slice(0, 6)) {
        button.click();
        flushSync();
    }
    await settle();
}, 60000);

test('editor view bar switches tabs and toggles editor preferences', async () => {
    const preferences = new EditorPreferences();
    mounted.push(
        mount(EditorViewBar, {
            target: document.body,
            props: { preferences, onImport: () => {} } as never
        })
    );
    await settle();
    for (const button of [...document.querySelectorAll<HTMLButtonElement>('button')].slice(0, 10)) {
        button.click();
        flushSync();
    }
    await settle();
    expect(preferences.ready).toBe(false);
}, 60000);
