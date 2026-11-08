// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from 'bun:test';
import { page } from '$app/state';
import {
    clearArticleHash,
    currentPermalink,
    showArticleFragment
} from '../apps/web/src/lib/article/articleHash.ts';

const original = { url: page.url as unknown as URL, state: page.state as unknown };

afterEach(() => {
    (page as unknown as { url: URL }).url = original.url;
    (page as unknown as { state: unknown }).state = original.state;
});

test('reads the permalink from page state first, then from the decoded hash', () => {
    (page as unknown as { state: Record<string, unknown> }).state = { permalink: 'stored' };
    expect(currentPermalink()).toBe('stored');

    (page as unknown as { state: Record<string, unknown> }).state = {};
    (page as unknown as { url: URL }).url = new URL('https://dom.test/blog/x#Caf%C3%A9');
    expect(currentPermalink()).toBe('Café');

    (page as unknown as { url: URL }).url = new URL('https://dom.test/blog/x#%E0%A4%A');
    expect(currentPermalink()).toBe('');
});

test('shows and clears article fragments without throwing', () => {
    expect(() => showArticleFragment('intro')).not.toThrow();
    expect(() => showArticleFragment('intro', true)).not.toThrow();
    window.history.replaceState(null, '', '/blog/x#intro');
    expect(() => clearArticleHash()).not.toThrow();
    window.history.replaceState(null, '', '/blog/x');
    expect(() => clearArticleHash()).not.toThrow();
});
