// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const OPENTELEMETRY_API_IDS = new Set([
    '@opentelemetry/api',
    '@sentry/sveltekit/opentelemetry-api'
]);

export function bundledOpenTelemetryApiPlugin(): Plugin {
    const entry = fileURLToPath(import.meta.resolve('@opentelemetry/api'));
    return {
        name: 'bundled-opentelemetry-api',
        enforce: 'pre',
        apply: 'build',
        resolveId(id, _importer, options) {
            return options?.ssr && OPENTELEMETRY_API_IDS.has(id) ? entry : null;
        }
    };
}
