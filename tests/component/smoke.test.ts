// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from 'bun:test';
import { flushSync, mount, unmount } from 'svelte';
import { page } from '$app/state';
import { lenient } from '../lenient.ts';

const root = new URL('../../', import.meta.url).pathname;
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

function exercise() {
    for (let round = 0; round < 4; round++) {
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
