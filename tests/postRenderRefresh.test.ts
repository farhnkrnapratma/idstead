import { describe, expect, test } from 'bun:test';
import type { PostRenderStore, PostSource } from '../packages/data/src/index.ts';
import {
    RENDER_VERSION,
    renderMarkdown,
    unavailableResolvers
} from '../packages/mdrs-core/src/index.ts';
import { refreshPostRenders } from '../packages/lib/src/server/postRender.ts';
import { createSupabaseMdrsResolvers } from '../packages/lib/src/server/mdrsData.ts';

const post = (n: number) =>
    `posts/0f8fad5b-d9cb-469f-a165-70867728950e/7c9e6679-7425-40de-944b-e07fc1f9000${n}.md`;
const renderOf = (path: string) => path.replace(/\.md$/, '.render.json');
const stored = (live: boolean, version = RENDER_VERSION) =>
    JSON.stringify({ version, live, html: '<p>old</p>', headings: [], readTime: '1 min read' });

function memoryStore(files: Record<string, string>, paths: string[]) {
    const uploads: string[] = [];
    const sources = new Map<PostSource, string>();
    const pathOf = (source: PostSource) => sources.get(source)!;
    const store: PostRenderStore = {
        listRenderCandidates: async limit =>
            paths.slice(0, limit).map(path => {
                const source: PostSource = { kind: 'post-source' };
                sources.set(source, path);
                return source;
            }),
        downloadMarkdown: async source => files[pathOf(source)] ?? null,
        downloadRender: async source => files[renderOf(pathOf(source))] ?? null,
        writeRender: async (source, render) => {
            uploads.push(renderOf(pathOf(source)));
            files[renderOf(pathOf(source))] = render;
        },
        renderPath: source => renderOf(pathOf(source))
    };
    return { store, uploads, files };
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
        const { store, uploads } = memoryStore(files, paths);
        const result = await refreshPostRenders(store, unavailableResolvers());
        expect(result).toEqual({ checked: 4, rendered: 3, failed: 0 });
        expect(uploads).toEqual([renderOf(post(1)), renderOf(post(3)), renderOf(post(4))]);
        expect(JSON.parse(files[renderOf(post(3))]).html).toContain('Missing render');
    });

    test('stops after the render budget', async () => {
        const paths = [post(1), post(2), post(3)];
        const files = Object.fromEntries(paths.map(path => [path, '# Post']));
        const { store, uploads } = memoryStore(files, paths);
        const result = await refreshPostRenders(store, unavailableResolvers(), 2);
        expect(result.rendered).toBe(2);
        expect(uploads).toHaveLength(2);
    });

    test('counts a missing markdown file as a failure and keeps going', async () => {
        const paths = [post(1), post(2)];
        const { store } = memoryStore({ [post(2)]: '# Present' }, paths);
        const result = await refreshPostRenders(store, unavailableResolvers());
        expect(result).toEqual({ checked: 2, rendered: 1, failed: 1 });
    });
});

describe('createSupabaseMdrsResolvers', () => {
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
        const resolvers = createSupabaseMdrsResolvers(client);
        await renderMarkdown(
            ':::define\na: api.v1.blog.length\nb: api.v1.blog\n:::\n\n${a} ${b.length}',
            resolvers
        );
        expect(tables).toEqual(['db_posts']);
        await renderMarkdown(':::define\nc: api.v1.blog.length\n:::\n\n${c}', resolvers);
        expect(tables).toEqual(['db_posts']);
    });
});
