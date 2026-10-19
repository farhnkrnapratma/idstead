import { describe, expect, test } from 'bun:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
    RENDER_VERSION,
    renderMarkdown,
    unavailableResolvers
} from '../packages/mdrs/src/index.ts';
import { refreshPostRenders } from '../packages/lib/src/server/postRender.ts';
import { createMdrsResolvers } from '../packages/lib/src/mdrsResolvers.ts';

const post = (n: number) =>
    `posts/0f8fad5b-d9cb-469f-a165-70867728950e/7c9e6679-7425-40de-944b-e07fc1f9000${n}.md`;
const renderOf = (path: string) => path.replace(/\.md$/, '.render.json');
const stored = (live: boolean, version = RENDER_VERSION) =>
    JSON.stringify({ version, live, html: '<p>old</p>', headings: [], readTime: '1 min read' });

function fakeDb(files: Record<string, string>, paths: string[]) {
    const uploads: string[] = [];
    const db = {
        from: () => ({
            select: () => ({
                eq: () => ({
                    order: () => ({
                        limit: async () => ({
                            data: paths.map(storage_path => ({ storage_path })),
                            error: null
                        })
                    })
                })
            })
        }),
        storage: {
            from: () => ({
                download: async (path: string) =>
                    path in files ?
                        { data: new Blob([files[path]]), error: null }
                    :   { data: null, error: { message: 'not found' } },
                upload: async (path: string, body: Blob) => {
                    uploads.push(path);
                    files[path] = await body.text();
                    return { error: null };
                }
            })
        }
    } as unknown as SupabaseClient;
    return { db, uploads, files };
}

describe('refreshPostRenders', () => {
    test('re-renders live, missing and outdated renders and skips current static ones', async () => {
        const paths = [post(1), post(2), post(3), post(4)];
        const files: Record<string, string> = {
            [post(1)]: '# Live',
            [renderOf(post(1))]: stored(true),
            [post(2)]: '# Static',
            [renderOf(post(2))]: stored(false),
            [post(3)]: '# Missing render',
            [post(4)]: '# Outdated',
            [renderOf(post(4))]: stored(false, RENDER_VERSION - 1)
        };
        const { db, uploads } = fakeDb(files, paths);
        const result = await refreshPostRenders(db, unavailableResolvers());
        expect(result).toEqual({ checked: 4, rendered: 3, failed: 0 });
        expect(uploads).toEqual([renderOf(post(1)), renderOf(post(3)), renderOf(post(4))]);
        expect(JSON.parse(files[renderOf(post(3))]).html).toContain('Missing render');
    });

    test('stops after the render budget', async () => {
        const paths = [post(1), post(2), post(3)];
        const files = Object.fromEntries(paths.map(path => [path, '# Post']));
        const { db, uploads } = fakeDb(files, paths);
        const result = await refreshPostRenders(db, unavailableResolvers(), 2);
        expect(result.rendered).toBe(2);
        expect(uploads).toHaveLength(2);
    });

    test('counts a missing markdown file as a failure and keeps going', async () => {
        const paths = [post(1), post(2)];
        const { db } = fakeDb({ [post(2)]: '# Present' }, paths);
        const result = await refreshPostRenders(db, unavailableResolvers());
        expect(result).toEqual({ checked: 2, rendered: 1, failed: 1 });
    });
});

describe('createMdrsResolvers', () => {
    test('fetches the blog list once per render, however often it is referenced', async () => {
        const tables: string[] = [];
        const chain: unknown = new Proxy(() => {}, {
            get(_target, key) {
                if (key === 'then')
                    return (resolve: (value: unknown) => void) =>
                        resolve({ data: [], error: null });
                return () => chain;
            },
            apply: () => chain
        });
        const client = {
            from: (table: string) => {
                tables.push(table);
                return chain;
            },
            storage: { from: () => chain }
        };
        const resolvers = createMdrsResolvers(client);
        await renderMarkdown(
            ':::define\na: api.v1.blog.length\nb: api.v1.blog\n:::\n\n${a} ${b.length}',
            resolvers
        );
        expect(tables).toEqual(['db_posts']);
        await renderMarkdown(':::define\nc: api.v1.blog.length\n:::\n\n${c}', resolvers);
        expect(tables).toEqual(['db_posts']);
    });
});
