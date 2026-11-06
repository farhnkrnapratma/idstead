// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { adminNotificationsStore as store } from '../apps/admin/src/lib/stores/adminNotificationsStore.svelte.ts';
import { toastStore } from '../packages/ui/src/stores/toastStore.svelte.ts';

const operation = { operationId: 'op', count: 0, completed: true, deletedCount: 0 };
const realFetch = globalThis.fetch;
const realSession = globalThis.sessionStorage;

type Route = (url: URL, body: unknown) => unknown;
let route: Route = () => ({});
let calls: Array<{ url: URL; body: unknown }> = [];

function row(id: string, extra: Record<string, unknown> = {}) {
    return {
        id,
        kind: 'comment_new',
        post_id: 'post-1',
        comment_id: null,
        source_id: null,
        page_type: 'article',
        page_id: 'post-1',
        page_title: 'Post',
        page_url: '/blog/post',
        meta: null,
        created_at: '2026-05-01T00:00:00.000Z',
        read_at: null,
        ...extra
    };
}

function inbox(items: unknown[], extra: Record<string, unknown> = {}) {
    return { items, nextCursor: null, total: items.length, unreadCount: 1, ...extra };
}

beforeEach(() => {
    calls = [];
    route = () => ({});
    const memory = new Map<string, string>();
    Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        value: {
            getItem: (key: string) => memory.get(key) ?? null,
            setItem: (key: string, value: string) => void memory.set(key, value)
        }
    });
    globalThis.fetch = (async (input: string, init?: RequestInit) => {
        const url = new URL(input, 'https://admin.test');
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ url, body });
        const result = route(url, body);
        if (result instanceof Error) throw result;
        return Response.json(result);
    }) as unknown as typeof fetch;
});

afterEach(() => {
    store.unsubscribe();
    globalThis.fetch = realFetch;
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: realSession });
});

const wait = () => new Promise(resolve => setTimeout(resolve, 0));

describe('adminNotificationsStore', () => {
    test('restores valid saved preferences and ignores invalid ones', async () => {
        Object.defineProperty(globalThis, 'sessionStorage', {
            configurable: true,
            value: {
                getItem: () =>
                    JSON.stringify({
                        query: 'spam',
                        type: 'helpful',
                        read: 'unread',
                        sort: 'page',
                        direction: 'asc'
                    }),
                setItem() {}
            }
        });
        route = () => inbox([row('a')]);
        await store.loadMore();
        expect(store.preferences).toMatchObject({ query: 'spam', type: 'helpful', read: 'unread' });

        store.unsubscribe();
        Object.defineProperty(globalThis, 'sessionStorage', {
            configurable: true,
            value: {
                getItem: () =>
                    JSON.stringify({
                        query: 'x'.repeat(201),
                        type: 'all',
                        read: 'all',
                        sort: 'date',
                        direction: 'desc'
                    }),
                setItem() {}
            }
        });
        const before = store.preferences;
        await store.loadMore();
        expect(store.preferences).toEqual(before);
    });

    test('ignores unreadable saved preferences', async () => {
        Object.defineProperty(globalThis, 'sessionStorage', {
            configurable: true,
            value: {
                getItem: () => {
                    throw new Error('blocked');
                },
                setItem() {}
            }
        });
        route = () => inbox([]);
        const before = store.preferences;
        await store.loadMore();
        expect(store.preferences).toEqual(before);
    });

    test('loads the summary, notifies listeners on a new revision and reports failures', async () => {
        let notified = 0;
        const stop = store.onActivityRefresh(async () => {
            notified++;
        });
        const failing = store.onActivityRefresh(async () => {
            throw new Error('listener');
        });
        route = (url: URL) =>
            url.searchParams.get('section') === 'summary' ?
                { unreadCount: 3, total: 9, revision: 'r1' }
            :   {};
        await store.load();
        expect(store.unreadCount).toBe(3);
        expect(store.total).toBe(9);
        expect(store.isLoaded).toBe(true);
        expect(notified).toBe(1);

        await store.load();
        expect(notified).toBe(1);

        stop();
        failing();
        route = () => new Error('down');
        await store.load();
        expect(store.activityError).toBe('Updates could not be checked. Refresh to try again.');
    });

    test('shares one summary request while it is in flight', async () => {
        route = () => ({ unreadCount: 0, total: 0, revision: 'r0' });
        const first = store.load();
        const second = store.load();
        await Promise.all([first, second]);
        expect(
            calls.filter(call => call.url.searchParams.get('section') === 'summary')
        ).toHaveLength(1);
    });

    test('loads, paginates and reports inbox errors', async () => {
        route = (url: URL) => {
            if (url.searchParams.has('section')) return { unreadCount: 0, total: 0, revision: '' };
            const cursor = url.searchParams.get('cursor');
            if (!cursor)
                return inbox([row('a'), row('b')], {
                    nextCursor: { value: 'v', date: 'd', id: 'b' },
                    total: 3,
                    unreadCount: 2
                });
            return inbox([row('c')], { total: 3, unreadCount: 2 });
        };
        store.setPreferences({ query: 'hi' });
        await wait();
        expect(store.items.map(item => item.id)).toEqual(['a', 'b']);
        expect(store.hasMore).toBe(true);
        expect(store.isLoaded).toBe(true);

        await store.loadMore();
        expect(store.items.map(item => item.id)).toEqual(['a', 'b', 'c']);
        expect(store.hasMore).toBe(false);

        await store.loadMore();
        expect(store.items.length).toBe(3);

        route = () => new Error('inbox down');
        store.setPreferences({ type: 'helpful' });
        await wait();
        expect(store.error).toBe('inbox down');
        expect(store.isLoading).toBe(false);
    });

    test('uses a generic error for non-error failures', async () => {
        globalThis.fetch = (async () => {
            throw 'odd';
        }) as unknown as typeof fetch;
        store.setPreferences({ read: 'read' });
        await wait();
        expect(store.error).toBe('Notifications could not be loaded.');
    });

    test('stores preferences and survives storage failures', async () => {
        route = () => inbox([]);
        Object.defineProperty(globalThis, 'sessionStorage', {
            configurable: true,
            value: {
                getItem: () => null,
                setItem: () => {
                    throw new Error('full');
                }
            }
        });
        store.setPreferences({ sort: 'type', direction: 'asc' });
        expect(store.preferences).toMatchObject({ sort: 'type', direction: 'asc' });
    });

    test('marks, dismisses and pins notifications and refreshes afterwards', async () => {
        route = (url: URL, body: unknown) => {
            if (body !== undefined) return operation;
            return url.searchParams.has('section') ?
                    { unreadCount: 0, total: 0, revision: 'x' }
                :   inbox([]);
        };
        expect(await store.markRead('a')).toBe(true);
        expect(await store.markAllRead()).toBe(true);
        expect(await store.dismiss('a')).toBe(true);
        expect(await store.setPinned('a', true)).toBe(true);
        expect(await store.setPinned('a', false)).toBe(true);
        expect(
            calls
                .filter(call => call.body !== undefined)
                .map(call => (call.body as { action: string }).action)
        ).toEqual(['read', 'read_all', 'delete', 'pin', 'unpin']);
    });

    test('reports mutation failures through a toast', async () => {
        route = (_url: URL, body: unknown) =>
            body !== undefined ? new Error('denied') : inbox([]);
        expect(await store.markRead('a')).toBe(false);
        expect(toastStore.message).toBe('denied');
        globalThis.fetch = (async () => {
            throw 'odd';
        }) as unknown as typeof fetch;
        expect(await store.markAllRead()).toBe(false);
        expect(toastStore.message).toBe('Notification update failed.');
    });

    test('rejects a second mutation while one is running', async () => {
        let release!: () => void;
        const gate = new Promise<void>(resolve => (release = resolve));
        globalThis.fetch = (async (input: string, init?: RequestInit) => {
            calls.push({
                url: new URL(input, 'https://admin.test'),
                body: JSON.parse(String(init?.body))
            });
            await gate;
            return Response.json(operation);
        }) as unknown as typeof fetch;
        const first = store.prepareClear('op');
        await expect(store.clear('op2')).rejects.toThrow(
            'A notification update is already running.'
        );
        release();
        expect(await first).toEqual(operation);
    });

    test('subscribes once, refreshes when visible and cleans up on unsubscribe', async () => {
        route = () => ({ unreadCount: 0, total: 0, revision: 'a' });
        store.subscribe();
        store.subscribe();
        await wait();
        expect(store.isLoaded).toBe(true);
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new Event('focus'));
        window.dispatchEvent(new Event('online'));
        await wait();
        store.unsubscribe();
        expect(store.unreadCount).toBe(0);
        expect(store.items).toEqual([]);
    });
});
