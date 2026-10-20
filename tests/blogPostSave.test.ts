import { describe, expect, test } from 'bun:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { savePostOperation } from '../packages/lib/src/server/blogPostSave.ts';
import { createSupabasePostOperationStore } from '../packages/data/src/supabase/adminPosts.ts';

const postId = '0f8fad5b-d9cb-469f-a165-70867728950e';
const operationId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const markdownPath = `posts/${postId}/${operationId}.md`;
const renderPath = `posts/${postId}/${operationId}.render.json`;

function fakeDb(renderUploadFails = false) {
    const uploads: { path: string; upsert: boolean; contentType: string }[] = [];
    const db = {
        rpc: async (name: string) => {
            if (name === 'db_prepare_post_operation')
                return { data: { id: operationId, state: 'pending', result: null }, error: null };
            if (name === 'db_ready_post_operation') return { data: null, error: null };
            return {
                data: { id: operationId, state: 'committed', result: { id: postId } },
                error: null
            };
        },
        storage: {
            from: () => ({
                upload: async (
                    path: string,
                    _body: Blob,
                    options: { upsert: boolean; contentType: string }
                ) => {
                    uploads.push({
                        path,
                        upsert: options.upsert,
                        contentType: options.contentType
                    });
                    if (renderUploadFails && path === renderPath)
                        return { error: { message: 'down' } };
                    return { error: null };
                }
            })
        }
    } as unknown as SupabaseClient;
    return { db: createSupabasePostOperationStore(db), uploads };
}

const input = {
    operationId,
    id: postId,
    hash: 'hash',
    revision: null,
    kind: 'save',
    post: {},
    banner: { operation: 'replace' },
    image: null,
    markdown: '# Hello'
} as unknown as Parameters<typeof savePostOperation>[2];

describe('savePostOperation pre-render upload', () => {
    test('stores the render next to the markdown file', async () => {
        const { db, uploads } = fakeDb();
        const operation = await savePostOperation(db, 'actor', input, async () => {}, '{}');
        expect(operation.state).toBe('committed');
        expect(uploads).toEqual([
            { path: markdownPath, upsert: false, contentType: 'text/markdown' },
            { path: renderPath, upsert: true, contentType: 'application/json' }
        ]);
    });

    test('skips the render upload when pre-rendering failed', async () => {
        const { db, uploads } = fakeDb();
        await savePostOperation(db, 'actor', input, async () => {});
        expect(uploads.map(upload => upload.path)).toEqual([markdownPath]);
    });

    test('a failed render upload does not fail the save', async () => {
        const { db } = fakeDb(true);
        const operation = await savePostOperation(db, 'actor', input, async () => {}, '{}');
        expect(operation.state).toBe('committed');
    });
});
