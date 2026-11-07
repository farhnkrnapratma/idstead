// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
    PostSaveError,
    postSaveButtonLabel,
    recallPostSave,
    rememberPostSave,
    submitPost
} from '../apps/admin/src/lib/postSaveClient';

describe('post save button label', () => {
    test('shows the initial publish and draft progress labels', () => {
        expect(postSaveButtonLabel(true, false, 'publish')).toBe('Publishing…');
        expect(postSaveButtonLabel(true, false, 'draft')).toBe('Saving draft…');
    });

    test('shows retry labels only for an existing save or when idle', () => {
        expect(postSaveButtonLabel(true, true, 'publish')).toBe('Retrying…');
        expect(postSaveButtonLabel(false, false, 'publish')).toBe('Retry Save');
    });
});

const realFetch = globalThis.fetch;
const realIndexedDB = globalThis.indexedDB;
let replies: Array<Response | Error> = [];
let requests: string[] = [];

beforeEach(() => {
    replies = [];
    requests = [];
    globalThis.fetch = (async (input: string) => {
        requests.push(String(input));
        const reply = replies.shift();
        if (reply instanceof Error) throw reply;
        return reply ?? new Response('{}', { status: 500 });
    }) as unknown as typeof fetch;
});

afterEach(() => {
    globalThis.fetch = realFetch;
    globalThis.indexedDB = realIndexedDB;
});

const json = (status: number, body: unknown) => Response.json(body, { status });

function saveForm() {
    const form = new FormData();
    form.set('post', JSON.stringify({ operationId: 'op-1' }));
    return form;
}

async function failureOf(promise: Promise<unknown>) {
    try {
        await promise;
    } catch (error) {
        return error as PostSaveError;
    }
    throw new Error('expected a rejection');
}

describe('submitPost', () => {
    test('returns the saved post when the server confirms it', async () => {
        const post = {
            id: 'p1',
            post_revision: 2,
            banner_version: null,
            slug: 's',
            published: true
        };
        replies = [json(200, { success: true, post })];
        expect(await submitPost(saveForm())).toMatchObject({ post: { id: 'p1' } });
        expect(requests).toEqual(['/api/internal/admin/posts']);
    });

    test('reports definitive rejections with the server message', async () => {
        replies = [json(400, { error: { message: 'Slug taken' } })];
        const error = await failureOf(submitPost(saveForm()));
        expect(error).toBeInstanceOf(PostSaveError);
        expect(error.message).toBe('Slug taken');
        expect(error.definitive).toBe(true);
    });

    test('falls back to the top-level message and then to a generic one', async () => {
        replies = [json(422, { message: 'Bad markdown' })];
        expect((await failureOf(submitPost(saveForm()))).message).toBe('Bad markdown');
        replies = [json(409, {})];
        expect((await failureOf(submitPost(saveForm()))).message).toBe('Post could not be saved.');
    });

    test('treats authorization failures as not definitive', async () => {
        replies = [json(403, { message: 'Forbidden' })];
        const error = await failureOf(submitPost(saveForm()));
        expect(error.definitive).toBe(false);
        replies = [json(401, {})];
        const expired = await failureOf(submitPost(saveForm()));
        expect(expired.definitive).toBe(false);
        expect(expired.message).toContain('admin session has expired');
    });

    test('reconciles a lost response from the operation status', async () => {
        const post = {
            id: 'p1',
            post_revision: 3,
            banner_version: null,
            slug: 's',
            published: false
        };
        replies = [new Error('offline'), json(200, { state: 'committed', post })];
        const result = await submitPost(saveForm());
        expect(result).toMatchObject({ cleanupPending: true, post: { id: 'p1' } });
        expect(requests.at(-1)).toBe('/api/internal/admin/posts?operationId=op-1');
    });

    test('reports rejected and conflicting operations as definitive', async () => {
        replies = [new Error('offline'), json(200, { state: 'rejected' })];
        const rejected = await failureOf(submitPost(saveForm()));
        expect(rejected.message).toContain('slug is unique');
        expect(rejected.definitive).toBe(true);

        replies = [new Error('offline'), json(200, { state: 'conflict' })];
        const conflict = await failureOf(submitPost(saveForm()));
        expect(conflict.message).toContain('changed in another session');
        expect(conflict.definitive).toBe(true);
    });

    test('keeps unconfirmed saves retryable', async () => {
        replies = [new Error('offline'), new Response('oops', { status: 500 })];
        const failed = await failureOf(submitPost(saveForm()));
        expect(failed.message).toContain('Save is not confirmed');
        expect(failed.definitive).toBe(false);

        replies = [new Error('offline'), json(200, { state: 'pending' })];
        expect((await failureOf(submitPost(saveForm()))).definitive).toBe(false);
    });
});

function installIndexedDB(
    options: { openError?: boolean; txError?: boolean; abort?: boolean; getError?: boolean } = {}
) {
    const stores = new Map<string, unknown>();
    globalThis.indexedDB = {
        open() {
            const request: Record<string, unknown> & { result?: unknown } = {};
            queueMicrotask(() => {
                if (options.openError) return (request.onerror as () => void)?.();
                request.result = {
                    transaction() {
                        const transaction: Record<string, unknown> = {
                            error: new Error('transaction')
                        };
                        const objectStore = {
                            put: (value: unknown, key: string) => void stores.set(key, value),
                            delete: (key: string) => void stores.delete(key),
                            get(key: string) {
                                const get: Record<string, unknown> & {
                                    result?: unknown;
                                    error?: unknown;
                                } = { result: stores.get(key) };
                                queueMicrotask(() => {
                                    if (options.getError) {
                                        get.error = new Error('get');
                                        (get.onerror as () => void)?.();
                                    } else (get.onsuccess as () => void)?.();
                                });
                                return get;
                            }
                        };
                        queueMicrotask(() => {
                            if (options.txError) (transaction.onerror as () => void)?.();
                            else if (options.abort) (transaction.onabort as () => void)?.();
                            else (transaction.oncomplete as () => void)?.();
                        });
                        return Object.assign(transaction, { objectStore: () => objectStore });
                    },
                    createObjectStore() {},
                    close() {}
                };
                (request.onupgradeneeded as () => void)?.();
                (request.onsuccess as () => void)?.();
            });
            return request;
        }
    } as unknown as IDBFactory;
    return stores;
}

describe('recovery storage', () => {
    test('remembers a save and recalls it as form data', async () => {
        installIndexedDB();
        const form = new FormData();
        form.set('title', 'Hello');
        await rememberPostSave('op-1', form);
        const recalled = await recallPostSave('op-1');
        expect(recalled?.get('title')).toBe('Hello');
    });

    test('forgets a save when it is remembered without form data', async () => {
        installIndexedDB();
        await rememberPostSave('op-2', new FormData());
        await rememberPostSave('op-2', null);
        expect(await recallPostSave('op-2')).toBeNull();
    });

    test('reports storage failures', async () => {
        installIndexedDB({ openError: true });
        expect((await failureOf(recallPostSave('op-3'))).message).toContain(
            'browser storage permissions'
        );

        installIndexedDB({ txError: true });
        expect(await failureOf(rememberPostSave('op-3', new FormData()))).toBeInstanceOf(Error);

        installIndexedDB({ abort: true });
        expect(await failureOf(rememberPostSave('op-3', new FormData()))).toBeInstanceOf(Error);

        installIndexedDB({ getError: true });
        expect(await failureOf(recallPostSave('op-3'))).toBeInstanceOf(Error);
    });
});
