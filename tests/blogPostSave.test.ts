import { describe, expect, test } from 'bun:test';
import { savePostOperation } from '../packages/lib/src/server/blogPostSave.ts';
import type { PostOperationStore } from '../packages/data/src/adminPosts.ts';

const postId = '0f8fad5b-d9cb-469f-a165-70867728950e';
const operationId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const markdownPath = `posts/${postId}/${operationId}.md`;
const renderPath = `posts/${postId}/${operationId}.render.json`;

function fakeDb(renderUploadFails = false) {
    const uploads: string[] = [];
    const db: PostOperationStore = {
        prepare: async () => ({
            status: 'prepared',
            operation: { id: operationId, state: 'pending', result: null }
        }),
        revision: async () => null,
        writeMarkdown: async (post, operation) => {
            uploads.push(`posts/${post}/${operation}.md`);
        },
        writeRender: async (post, operation) => {
            uploads.push(`posts/${post}/${operation}.render.json`);
            if (renderUploadFails) throw new Error('down');
        },
        ready: async () => {},
        commit: async () => ({ id: operationId, state: 'committed', result: { id: postId } }),
        find: async () => null
    };
    return { db, uploads };
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
        expect(uploads).toEqual([markdownPath, renderPath]);
    });

    test('skips the render upload when pre-rendering failed', async () => {
        const { db, uploads } = fakeDb();
        await savePostOperation(db, 'actor', input, async () => {});
        expect(uploads).toEqual([markdownPath]);
    });

    test('a failed render upload does not fail the save', async () => {
        const { db } = fakeDb(true);
        const operation = await savePostOperation(db, 'actor', input, async () => {}, '{}');
        expect(operation.state).toBe('committed');
    });
});
