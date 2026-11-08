// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { page } from '$app/state';
import type { SpotlightItem } from '../apps/web/src/lib/components/spotlight/types.ts';

const realApiConfig = await import('../packages/lib/src/apiConfig.ts');
mock.module('../packages/lib/src/apiConfig.ts', () => ({
    ...realApiConfig,
    API_VERSIONS: ['v1', 'v0']
}));
mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'http://localhost:8787' }));

const target = '../apps/web/src/lib/components/spotlight/dynamicCommands.ts?case=keyed';
const { createDynamicCommandItems } = (await import(
    target
)) as typeof import('../apps/web/src/lib/components/spotlight/dynamicCommands.ts');

const requests: unknown[] = [];
const getItems = createDynamicCommandItems({
    close: () => {},
    setHelp: () => {},
    openShare: () => {},
    openQr: () => {},
    requestMailing: request => void requests.push(request)
});

const roots = [
    '/mailing',
    '/mai',
    '/api',
    '/ap',
    '/theme',
    '/the',
    '/a11y',
    '/a1',
    '/goto',
    '/go',
    '/copy',
    '/cop',
    '/save',
    '/sav',
    '/code',
    '/cod'
];
const firsts = [
    '',
    'subscribe',
    'sub',
    'unsubscribe',
    'unsub',
    'a@b.co',
    'v1',
    'v',
    'v9',
    'auto',
    'system',
    'dark',
    'light',
    'reduce-motion',
    'motion',
    'high-contrast',
    'focus-ring',
    'dyslexic-text',
    'text-size',
    'size',
    'font-scale',
    'reset',
    'home',
    'blog',
    'projects',
    'resume',
    'funding',
    'contact',
    'terms',
    'privacy',
    'security',
    'ai-disclosure',
    'feedback',
    'feed',
    'api',
    'url',
    'link',
    'pid',
    'page-id',
    'id',
    'md',
    'markdown',
    'txt',
    'text',
    'wrap',
    'lines',
    'clean',
    'theme',
    'zzz'
];
const seconds = [
    '',
    'on',
    'off',
    'a@b.co',
    'dark',
    'light',
    'auto',
    '100',
    '120%',
    '150',
    'x',
    'v1'
];

function queries() {
    const out: string[] = ['', 'plain', '/', '/zzz'];
    for (const root of roots)
        for (const first of firsts)
            for (const second of seconds) out.push([root, first, second].filter(Boolean).join(' '));
    out.push('  /theme   DARK  ', '/MAILING Subscribe A@B.CO', '/mailing unsubscribe a@b.co');
    return out;
}

const scenarios = [
    { path: '/', data: {} },
    { path: '/blog/my-post', data: { post: { id: 'post-1' } } },
    { path: '/blog/my-post', data: {} },
    { path: '/blog/', data: {} },
    { path: '/privacy', data: {} },
    { path: '/blog', data: {} }
];

const saved = { fetch: globalThis.fetch, clipboard: navigator.clipboard };
let fetchMode: 'ok' | 'bad' | 'throw' = 'ok';
let written: string[] = [];

beforeEach(() => {
    fetchMode = 'ok';
    written = [];
    requests.length = 0;
    globalThis.fetch = (async () => {
        if (fetchMode === 'throw') throw new Error('offline');
        return new Response('body', { status: fetchMode === 'ok' ? 200 : 500 });
    }) as never;
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text: string) => void written.push(text) }
    });
    URL.createObjectURL = () => 'blob:test';
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = () => {};
});

afterEach(() => {
    globalThis.fetch = saved.fetch;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: saved.clipboard });
    (page as unknown as { url: URL }).url = new URL('https://dom.test/');
    (page as unknown as { data: unknown }).data = {};
});

function collect() {
    const found = new Map<string, SpotlightItem>();
    for (const query of queries())
        for (const item of getItems(query)) found.set(`${item.id}|${item.title}`, item);
    return found;
}

describe('createDynamicCommandItems', () => {
    test('ignores queries that are not commands', () => {
        expect(getItems('')).toEqual([]);
        expect(getItems('theme')).toEqual([]);
        expect(getItems('/zzz')).toEqual([]);
    });

    test('offers every command family', () => {
        const ids = [...collect().values()].map(item => item.id);
        for (const prefix of [
            'dyn-mailing-',
            'dyn-api-',
            'dyn-theme-',
            'dyn-a11y-',
            'dyn-open-',
            'dyn-copy-',
            'dyn-save-',
            'dyn-code-'
        ])
            expect(ids.some(id => id.startsWith(prefix))).toBe(true);
    });

    test('mailing commands pass the parsed request on', async () => {
        const [subscribe] = getItems('/mailing subscribe a@b.co');
        subscribe.action?.();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(requests).toEqual([{ action: 'subscribe', email: 'a@b.co' }]);
    });

    for (const scenario of scenarios) {
        for (const mode of ['ok', 'bad', 'throw'] as const) {
            test(`runs every action on ${scenario.path} when fetch is ${mode}`, async () => {
                (page as unknown as { url: URL }).url = new URL(`https://dom.test${scenario.path}`);
                (page as unknown as { data: unknown }).data = scenario.data;
                fetchMode = mode;
                const items = collect();
                for (const item of items.values()) item.action?.();
                await new Promise(resolve => setTimeout(resolve, 0));
                expect(items.size).toBeGreaterThan(0);
            });
        }
    }

    test('copies the page address and identifier', async () => {
        (page as unknown as { url: URL }).url = new URL('https://dom.test/blog/my-post');
        (page as unknown as { data: unknown }).data = { post: { id: 'post-1' } };
        getItems('/copy pid')[0].action?.();
        getItems('/copy url')[0].action?.();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(written).toEqual(['post-1', 'https://dom.test/']);
    });
});
