import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { sentrySvelteKit } from '@sentry/sveltekit/vite';
import { webpWasmPlugin } from '../../tooling/vite/webp-wasm-plugin.ts';

const ENV_DIR = '../..';

export default defineConfig({
    envDir: ENV_DIR,
    plugins: [
        webpWasmPlugin(),
        sentrySvelteKit({
            org: 'farhnkrnapratma',
            project: 'www',
            authToken: process.env.SENTRY_AUTH_TOKEN,
            telemetry: false
        }),
        tailwindcss(),
        sveltekit({
            compilerOptions: {
                runes: ({ filename }) =>
                    filename.split(/[/\\]/).includes('node_modules') ? undefined : true
            },
            adapter: adapter(),
            env: { dir: ENV_DIR },
            tracing: { server: true }
        })
    ],
    resolve: {
        alias: [
            {
                find: /^openpgp$/,
                replacement: fileURLToPath(
                    new URL('../../node_modules/openpgp/dist/openpgp.min.mjs', import.meta.url)
                )
            }
        ]
    },
    ssr: { noExternal: ['@lucide/svelte', '@mdrs/core', '@idstead/domain', '@idstead/data'] }
});
