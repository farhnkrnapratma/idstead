// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { posix } from 'node:path';
import type { Plugin } from 'vite';

export function webpWasmPlugin(): Plugin {
    const virtual = 'virtual:banner-webp-wasm';
    const external = '__banner_webp_wasm__';
    let building = false;
    const binary = () =>
        readFileSync(
            createRequire(import.meta.url).resolve('@jsquash/webp/codec/dec/webp_dec.wasm')
        );
    return {
        name: 'banner-webp-wasm',
        enforce: 'pre',
        configResolved(config) {
            building = config.command === 'build';
        },
        resolveId(id) {
            if (id === virtual) return `\0${virtual}`;
            if (id === external) return { id, external: true };
        },
        load(id) {
            if (id !== `\0${virtual}`) return;
            const bytes = binary();
            if (!building)
                return `const module = new WebAssembly.Module(Uint8Array.from(atob(${JSON.stringify(bytes.toString('base64'))}), c => c.charCodeAt(0))); export default function getModule() { return module }`;
            this.emitFile({ type: 'asset', fileName: 'webp-dec.wasm', source: bytes });
            return `import module from '${external}'; export default function getModule() { return module }`;
        },
        renderChunk(code, chunk) {
            if (!code.includes(external)) return;
            const path = posix.relative(posix.dirname(chunk.fileName), 'webp-dec.wasm');
            return {
                code: code.replaceAll(external, path.startsWith('.') ? path : `./${path}`),
                map: null
            };
        }
    };
}
