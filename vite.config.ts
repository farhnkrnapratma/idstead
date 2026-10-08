import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import {sveltekit} from '@sveltejs/kit/vite';
import {sentrySvelteKit} from '@sentry/sveltekit/vite';
import {webpWasmPlugin} from './tooling/vite/webp-wasm-plugin.ts';

export default defineConfig({
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
        runes: ({filename}) =>
          filename.split(/[/\\]/).includes('node_modules') ? undefined : true
      },
      adapter: adapter(),
      tracing: {server: true}
    })
  ],
  ssr: {noExternal: ['@lucide/svelte']}
});
