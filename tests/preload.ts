// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { compile, compileModule } from 'svelte/compiler';

const natives = [
    'Request',
    'Response',
    'Headers',
    'fetch',
    'FormData',
    'Blob',
    'File',
    'AbortController',
    'AbortSignal',
    'URL',
    'URLSearchParams',
    'ReadableStream',
    'WritableStream',
    'TransformStream',
    'TextEncoder',
    'TextDecoder',
    'Event',
    'EventTarget',
    'CustomEvent',
    'MessageChannel',
    'MessagePort',
    'BroadcastChannel',
    'DOMException'
] as const;
const saved = Object.fromEntries(
    natives.map(name => [name, (globalThis as Record<string, unknown>)[name]])
);

GlobalRegistrator.register({ url: 'https://dom.test/' });
Object.assign(globalThis, saved);

const modules = new URL('../node_modules/', import.meta.url).pathname;
const redirects: Record<string, string> = {
    svelte: 'svelte/src/index-client.js',
    'svelte/legacy': 'svelte/src/legacy/legacy-client.js',
    'svelte/reactivity': 'svelte/src/reactivity/index-client.js',
    'svelte/store': 'svelte/src/store/index-client.js',
    '@blobatar/svelte': '@blobatar/svelte/src/index.js',
    '@blobatar/svelte/gaze': '@blobatar/svelte/src/gaze.js'
};

Bun.plugin({
    name: 'svelte-client',
    setup(build) {
        for (const [specifier, target] of Object.entries(redirects)) {
            build.module(specifier, () => ({
                contents: `export * from ${JSON.stringify(modules + target)};`,
                loader: 'js'
            }));
        }
        const noop = () => {};
        const asyncNoop = async () => {};
        build.module('$app/env', () => ({
            exports: { browser: true, dev: false, building: false, version: 'test' },
            loader: 'object'
        }));
        build.module('$app/env/public', () => ({ exports: {}, loader: 'object' }));
        build.module('$app/env/private', () => ({ exports: {}, loader: 'object' }));
        build.module('$app/state', () => ({
            exports: {
                page: {
                    url: new URL('https://dom.test/'),
                    params: {},
                    route: { id: null },
                    status: 200,
                    error: null,
                    data: {},
                    form: null,
                    state: {}
                },
                navigating: {
                    from: null,
                    to: null,
                    type: null,
                    willUnload: false,
                    delta: undefined,
                    complete: undefined
                },
                updated: { current: false, check: asyncNoop }
            },
            loader: 'object'
        }));
        build.module('$app/navigation', () => ({
            exports: {
                goto: asyncNoop,
                invalidate: asyncNoop,
                invalidateAll: asyncNoop,
                refreshAll: asyncNoop,
                preloadData: asyncNoop,
                preloadCode: asyncNoop,
                pushState: noop,
                replaceState: noop,
                beforeNavigate: noop,
                afterNavigate: noop,
                onNavigate: noop,
                disableScrollHandling: noop
            },
            loader: 'object'
        }));
        build.module('$app/stores', () => ({
            exports: {
                page: { subscribe: noop },
                navigating: { subscribe: noop },
                updated: { subscribe: noop, check: asyncNoop }
            },
            loader: 'object'
        }));
        build.module('cloudflare:workers', () => ({
            exports: { env: {}, waitUntil: noop },
            loader: 'object'
        }));
        build.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {
            const source = await Bun.file(path).text();
            const { js } = compile(source, { filename: path, generate: 'client', dev: false });
            const map = Buffer.from(JSON.stringify(js.map)).toString('base64');
            return {
                contents: `${js.code}\n//# sourceMappingURL=data:application/json;base64,${map}`,
                loader: 'js'
            };
        });
        build.onLoad({ filter: /\.svelte\.(ts|js)$/ }, async ({ path }) => {
            const source = await Bun.file(path).text();
            const code =
                path.endsWith('.ts') ?
                    new Bun.Transpiler({ loader: 'ts' }).transformSync(source)
                :   source;
            const { js } = compileModule(code, { filename: path, generate: 'client', dev: false });
            return { contents: js.code, loader: 'js' };
        });
    }
});
