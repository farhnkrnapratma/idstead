// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import { loadPublishedPosts } from '../packages/lib/src/server/blogPosts.ts';

test('returns no posts when the blog cannot be read', async () => {
    const posts = await loadPublishedPosts(
        (async () => new Response('{}', { status: 500 })) as unknown as typeof fetch
    );
    expect(posts).toEqual([]);
});
