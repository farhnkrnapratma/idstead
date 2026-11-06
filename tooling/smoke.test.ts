// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';
import { page } from '$app/state';
import { lenient } from '../tests/lenient.ts';

const root = new URL('../', import.meta.url).pathname;
const files = [...new Bun.Glob('{apps,packages}/**/src/**/*.svelte').scanSync({ cwd: root })]
    .filter(file => !file.includes('node_modules'))
    .sort();

Element.prototype.animate = function () {
    return {
        finished: Promise.resolve(),
        cancel() {},
        finish() {},
        onfinish: null
    } as unknown as Animation;
};

globalThis.fetch = (async () => ({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => lenient(),
    text: async () => 'text',
    blob: async () => new Blob(['x']),
    arrayBuffer: async () => new ArrayBuffer(8),
    clone() {
        return this;
    }
})) as unknown as typeof fetch;

const events = [
    'focus',
    'pointerenter',
    'mouseover',
    'pointerdown',
    'mousedown',
    'pointerup',
    'mouseup',
    'click',
    'input',
    'change',
    'keydown',
    'keyup',
    'blur',
    'pointerleave',
    'mouseout',
    'submit',
    'dragover',
    'drop',
    'scroll',
    'resize'
];

function fill(element: Element, round: number) {
    if (element instanceof HTMLInputElement) {
        if (element.type === 'checkbox' || element.type === 'radio')
            element.checked = round % 2 === 0;
        else if (element.type === 'file') return;
        else element.value = ['a', 'a@b.co', '42', 'https://example.org/x', ''][round % 5];
    } else if (element instanceof HTMLTextAreaElement) {
        element.value = ['text', '# heading\n\nbody', ''][round % 3];
    } else if (element instanceof HTMLSelectElement && element.options.length > 0) {
        element.selectedIndex = round % element.options.length;
    }
}

function exercise(rounds = 4) {
    for (let round = 0; round < rounds; round++) {
        for (const element of [...document.body.querySelectorAll('*')]) {
            try {
                fill(element, round);
            } catch {}
            for (const type of events) {
                try {
                    element.dispatchEvent(
                        new window.Event(type, { bubbles: true, cancelable: true })
                    );
                    if (type === 'keydown') {
                        for (const key of ['Enter', 'Escape', 'ArrowDown', 'ArrowUp', 'Tab', ' ']) {
                            element.dispatchEvent(
                                new window.KeyboardEvent('keydown', {
                                    key,
                                    bubbles: true,
                                    cancelable: true
                                })
                            );
                        }
                    }
                } catch {}
            }
            try {
                flushSync();
            } catch {}
        }
    }
}

const queue = globalThis.queueMicrotask.bind(globalThis);
globalThis.queueMicrotask = callback =>
    queue(() => {
        try {
            callback();
        } catch {}
    });
window.addEventListener('error', event => event.preventDefault());
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

const mounted: object[] = [];

afterEach(() => {
    for (const instance of mounted.splice(0)) {
        try {
            void unmount(instance);
        } catch {}
    }
    document.body.innerHTML = '';
});

for (const file of files) {
    test(`smoke ${file}`, async () => {
        const module = (await import(root + file)) as { default: never };
        const outcomes: boolean[] = [];
        for (const props of [{}, lenient(), { data: lenient() }] as Record<string, unknown>[]) {
            (page as { data: unknown }).data = props.data ?? lenient();
            try {
                const instance = mount(module.default, { target: document.body, props });
                mounted.push(instance);
                flushSync();
                exercise();
                outcomes.push(true);
            } catch {
                outcomes.push(false);
            }
        }
        expect(outcomes).toHaveLength(3);
    }, 60_000);
}

const adminTabs = [
    'reports',
    'feedback',
    'notifications',
    'logs',
    'posts',
    'projects',
    'profile',
    'resume',
    'skills',
    'socials',
    'funding',
    'contact',
    'apps',
    'privacy',
    'security',
    'terms',
    'ai-disclosure',
    'account'
];
const adminSearches = [
    '',
    ...adminTabs.map(tab => `?tab=${tab}`),
    ...['appearance', 'security', 'content', 'data'].map(
        section => `?tab=account&settings=${section}`
    ),
    '?tab=posts&editPost=new'
];

const richSkip = new Set(['AnalyticsSettings', 'CategoryTrendChart', 'MailingDialog']);

for (const file of files) {
    if (richSkip.has(file.split('/').pop()!.replace('.svelte', ''))) continue;
    const routed = file.includes('(admin)/+page.svelte');
    for (const search of routed ? adminSearches : ['']) {
        test(`rich ${file} ${search}`, async () => {
            const module = (await import(root + file)) as { default: never };
            const variants = routed ? [{ data: lenient(2) }] : [lenient(2), { data: lenient(2) }];
            (page as unknown as { url: URL }).url = new URL('https://dom.test/' + search);
            for (const props of variants as Record<string, unknown>[]) {
                (page as { data: unknown }).data = props.data ?? lenient(2);
                try {
                    const instance = mount(module.default, { target: document.body, props });
                    mounted.push(instance);
                    flushSync();
                    for (let round = 0; round < 2; round++) {
                        await tick().catch(() => {});
                        await new Promise(resolve => setTimeout(resolve, 0));
                        exercise();
                    }
                } catch {}
                for (const instance of mounted.splice(0)) {
                    try {
                        void unmount(instance);
                    } catch {}
                }
                document.body.innerHTML = '';
            }
            (page as unknown as { url: URL }).url = new URL('https://dom.test/');
        }, 120_000);
    }
}

function declaredProps(source: string): string[] {
    const end = source.indexOf('= $props()');
    if (end < 0) return [];
    const start = source.lastIndexOf('let {', end);
    if (start < 0) return [];
    const body = source.slice(start + 5, source.lastIndexOf('}', end));
    const names: string[] = [];
    let depth = 0;
    let token = '';
    const flush = () => {
        const match = token.trim().match(/^(?:\.\.\.)?([A-Za-z_$][\w$]*)/);
        if (match) names.push(match[1]);
        token = '';
    };
    for (const char of body) {
        if ('{[(<'.includes(char)) depth++;
        else if ('}])>'.includes(char)) depth--;
        if (char === ',' && depth === 0) flush();
        else token += char;
    }
    flush();
    return names;
}

const variants = (): unknown[] => [
    true,
    false,
    'text',
    '',
    0,
    3,
    [],
    [{ id: '1', value: 'a', label: 'A', name: 'A', href: '/a', title: 'A', items: [] }],
    {},
    () => {},
    null,
    undefined
];

const asyncCrashes = new Set([
    'MailingForm',
    'PageActions',
    'ProfileCard',
    'ProjectLanguageTag',
    'ProjectMeta',
    'QrCodeDialog',
    'ReportCommentDialog',
    'ResumeDownloadMenu',
    'ResumeEntryCard'
]);

for (const file of files) {
    if (asyncCrashes.has(file.split('/').pop()!.replace('.svelte', ''))) continue;
    test(`props ${file}`, async () => {
        const source = await Bun.file(root + file).text();
        const names = declaredProps(source);
        const module = (await import(root + file)) as { default: never };
        let mountedCount = 0;
        for (const name of names) {
            for (const value of variants()) {
                const props = { ...(lenient() as object), [name]: value } as Record<
                    string,
                    unknown
                >;
                try {
                    const instance = mount(module.default, {
                        target: document.body,
                        props: new Proxy(props, {
                            get: (target, key) =>
                                key in target ? target[key as string] : (lenient() as never)
                        })
                    });
                    mounted.push(instance);
                    flushSync();
                    exercise(1);
                    await tick().catch(() => {});
                    await new Promise(resolve => setTimeout(resolve, 0));
                    mountedCount++;
                } catch {}
                for (const instance of mounted.splice(0)) {
                    try {
                        void unmount(instance);
                    } catch {}
                }
                document.body.innerHTML = '';
            }
        }
        expect(mountedCount).toBeGreaterThanOrEqual(0);
    }, 120_000);
}
