// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, mock, test } from 'bun:test';

mock.module('@sentry/sveltekit', () => ({
    init: () => {},
    replayIntegration: () => ({}),
    feedbackIntegration: () => ({}),
    browserTracingIntegration: () => ({}),
    handleErrorWithSentry: (handler: unknown) => handler,
    sentryHandle:
        () =>
        async ({ event, resolve }: { event: unknown; resolve: (e: unknown) => unknown }) =>
            resolve(event),
    initCloudflareSentryHandle:
        () =>
        async ({ event, resolve }: { event: unknown; resolve: (e: unknown) => unknown }) =>
            resolve(event),
    getClient: () => undefined,
    captureException: () => {},
    captureMessage: () => {},
    withSentry: (_: unknown, handler: unknown) => handler,
    setUser: () => {},
    setTag: () => {},
    withScope: (callback: (scope: object) => void) => callback({}),
    logger: {}
}));

const root = new URL('../', import.meta.url).pathname;
const pattern = '{apps,packages}/**/src/**/*.{ts,js,svelte}';

const files = [...new Bun.Glob(pattern).scanSync({ cwd: root })]
    .filter(file => !file.includes('node_modules') && !file.endsWith('.d.ts'))
    .sort();
const failures: string[] = [];
for (const file of files) {
    try {
        await import(root + file);
    } catch (error) {
        failures.push(`${file}: ${String(error).split('\n')[0]}`);
    }
}

test('every source file loads', () => {
    expect(failures).toEqual([]);
});
