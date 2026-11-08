// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import { jsonStrings, readContent } from '../packages/data/src/d1/client.ts';

test('keeps only the string items of a JSON list column', () => {
    expect(jsonStrings('["a",1,"b",null]')).toEqual(['a', 'b']);
    expect(jsonStrings('{"not":"a list"}')).toEqual([]);
    expect(jsonStrings('{broken')).toEqual([]);
    expect(jsonStrings(42)).toEqual([]);
});

test('reads stored content and gives up on missing, failing or slow objects', async () => {
    const bucket = {
        get: async (key: string) => {
            if (key === 'content/posts/a.md') return { text: async () => '# A' };
            if (key === 'content/posts/fail.md') throw new Error('r2 down');
            return null;
        }
    } as never;
    expect(await readContent(bucket, null)).toBeNull();
    expect(await readContent(bucket, 'posts/a.md')).toBe('# A');
    expect(await readContent(bucket, 'posts/missing.md')).toBeNull();
    expect(await readContent(bucket, 'posts/fail.md')).toBeNull();

    const slow = { get: () => new Promise(() => {}) } as never;
    expect(await readContent(slow, 'posts/slow.md', 5)).toBeNull();
    expect(await readContent(bucket, 'posts/a.md', 1000)).toBe('# A');
});
