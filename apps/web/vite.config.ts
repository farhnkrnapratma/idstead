import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { sentrySvelteKit } from '@sentry/sveltekit/vite';
import { webpWasmPlugin } from '../../tooling/vite/webp-wasm-plugin.ts';

const ENV_DIR = '../..';
const LOCAL_STATE = '../../.wrangler/state/v3';

export default defineConfig({
    envDir: ENV_DIR,
    plugins: [
        webpWasmPlugin(),
        sentrySvelteKit({ authToken: process.env.SENTRY_AUTH_TOKEN, telemetry: false }),
        tailwindcss(),
        sveltekit({
            compilerOptions: {
                runes: ({ filename }) =>
                    filename.split(/[/\\]/).includes('node_modules') ? undefined : true
            },
            adapter: adapter({ platformProxy: { persist: { path: LOCAL_STATE } } }),
            env: { dir: ENV_DIR },
            tracing: { server: true }
        })
    ],
    // Resolve one Svelte instance in dev SSR. Two copies of svelte/internal/server
    // split the SSR context, so dev-only push_element reads a null context.
    resolve: { dedupe: ['svelte'] },
    ssr: {
        noExternal: [
            '@lucide/svelte',
            '@mdrs/core',
            '@mdrs/dom',
            '@idstead/domain',
            '@idstead/data',
            '@idstead/lib',
            '@idstead/ui'
        ]
    }
});
