// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { flushSync } from 'svelte';

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

export function exercise(rounds = 4) {
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
