// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from 'bun:test';
import { flushSync, mount, unmount } from 'svelte';

const root = new URL('../../', import.meta.url).pathname;
const files = [...new Bun.Glob('{apps,packages}/**/src/**/*.svelte').scanSync({ cwd: root })]
    .filter(file => !file.includes('node_modules'))
    .sort();

function lenient(): unknown {
    const target = function () {};
    return new Proxy(target, {
        get(_, key) {
            if (key === Symbol.toPrimitive) return () => '';
            if (key === Symbol.iterator) return function* () {};
            if (key === 'then') return undefined;
            if (key === 'length') return 0;
            return lenient();
        },
        apply: () => lenient(),
        has: () => true
    });
}

Element.prototype.animate = function () {
    return {
        finished: Promise.resolve(),
        cancel() {},
        finish() {},
        onfinish: null
    } as unknown as Animation;
};

globalThis.fetch = (async () =>
    new Response('{}', {
        headers: { 'content-type': 'application/json' }
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

function exercise() {
    for (const element of [...document.body.querySelectorAll('*')]) {
        for (const type of events) {
            try {
                element.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
                if (type === 'keydown') {
                    for (const key of ['Enter', 'Escape', 'ArrowDown', 'ArrowUp', 'Tab', ' ']) {
                        element.dispatchEvent(
                            new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
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
        for (const props of [{}, lenient()] as Record<string, unknown>[]) {
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
        expect(outcomes).toHaveLength(2);
    });
}
