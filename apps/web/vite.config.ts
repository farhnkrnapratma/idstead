// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

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
            csrf: { trustedOrigins: ['*'] },
            tracing: { server: true }
        })
    ],
    server: { fs: { allow: ['../../packages/ui/src/fonts'] } },
    ssr: { noExternal: ['@lucide/svelte', '@mdrs/core', '@idstead/domain', '@idstead/data'] }
});
