// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    BannerRequiredError,
    OperationReusedError,
    savePostOperation
} from '../packages/lib/src/server/blogPostSave.ts';
import type { PostOperationState, PostOperationStore } from '../packages/data/src/adminPosts.ts';

const postId = '0f8fad5b-d9cb-469f-a165-70867728950e';
const operationId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

type Override = Partial<PostOperationStore> & { state?: PostOperationState };

function store(overrides: Override = {}) {
    const calls: string[] = [];
    const { state = 'pending', ...rest } = overrides;
    const db: PostOperationStore = {
        prepare: async () =>
            ({ status: 'prepared', operation: { id: operationId, state, result: null } }) as never,
        revision: async () => null,
        writeMarkdown: async () => {
            calls.push('markdown');
        },
        writeRender: async () => {
            calls.push('render');
        },
        ready: async () => {
            calls.push('ready');
        },
        commit: async () => {
            calls.push('commit');
            return { id: operationId, state: 'committed', result: { id: postId } };
        },
        find: async () => null,
        ...rest
    } as PostOperationStore;
    return { db, calls };
}

function input(overrides: Record<string, unknown> = {}) {
    return {
        operationId,
        id: postId,
        hash: 'hash',
        revision: null,
        kind: 'save',
        post: {},
        banner: { operation: 'replace' },
        image: null,
        markdown: '# Hello',
        ...overrides
    } as unknown as Parameters<typeof savePostOperation>[2];
}

const actor = 'ada@example.com';

describe('savePostOperation states', () => {
    test('refuses an operation ID reused for different post data', async () => {
        const { db } = store({ prepare: async () => ({ status: 'reused' }) as never });
        await expect(savePostOperation(db, actor, input(), async () => {})).rejects.toBeInstanceOf(
            OperationReusedError
        );
    });

    test('returns an already settled operation without writing anything', async () => {
        for (const state of ['committed', 'conflict', 'rejected'] as const) {
            const { db, calls } = store({ state });
            const operation = await savePostOperation(db, actor, input(), async () => {});
            expect(operation.state).toBe(state);
            expect(calls).toEqual([]);
        }
    });

    test('requires a banner when a keep-banner save would publish one without it', async () => {
        const { db } = store({
            revision: async () => ({ post_revision: 2, banner_version: null })
        });
        await expect(
            savePostOperation(
                db,
                actor,
                input({ revision: 2, banner: { operation: 'keep' } }),
                async () => {}
            )
        ).rejects.toBeInstanceOf(BannerRequiredError);
    });

    test('uploads the banner image before writing the markdown', async () => {
        const { db, calls } = store();
        await savePostOperation(db, actor, input({ image: new Uint8Array([1]) }), async () => {
            calls.push('upload');
        });
        expect(calls).toEqual(['upload', 'markdown', 'ready', 'commit']);
    });

    test('asks the author to retry when the markdown upload fails', async () => {
        const { db } = store({
            writeMarkdown: async () => {
                throw new Error('r2 down');
            }
        });
        await expect(savePostOperation(db, actor, input(), async () => {})).rejects.toThrow(
            'Markdown upload failed. Retry the same Save operation.'
        );
    });

    test('recovers when the commit failed but the operation is already committed', async () => {
        const { db } = store({
            commit: async () => {
                throw new Error('timeout');
            },
            find: async () => ({ id: operationId, state: 'committed', result: { id: postId } })
        });
        const operation = await savePostOperation(db, actor, input(), async () => {});
        expect(operation.state).toBe('committed');
    });

    test('rethrows a commit failure that did not settle the operation', async () => {
        const { db } = store({
            commit: async () => {
                throw new Error('timeout');
            },
            find: async () => ({ id: operationId, state: 'pending', result: null })
        });
        await expect(savePostOperation(db, actor, input(), async () => {})).rejects.toThrow(
            'timeout'
        );
    });

    test('skips markdown and render writes for a delete operation', async () => {
        const { db, calls } = store();
        await savePostOperation(db, actor, input({ kind: 'delete' }), async () => {});
        expect(calls).toEqual(['ready', 'commit']);
    });
});
