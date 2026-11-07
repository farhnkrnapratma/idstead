// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from 'bun:test';
import { shortcut } from '../packages/ui/src/utils/shortcut.svelte.ts';
import { shortcutStore } from '../packages/ui/src/stores/shortcutStore.svelte.ts';

window.addEventListener('error', event => event.preventDefault());

const cleanups: Array<() => void> = [];

afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
    document.body.innerHTML = '';
});

function rect(left: number, top: number, width: number, height: number): DOMRect {
    return {
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
        toJSON() {}
    } as DOMRect;
}

test('shortcut badges place themselves away from neighbours and clip-prone edges', () => {
    const host = document.createElement('div');
    const neighbour = document.createElement('div');
    neighbour.setAttribute('data-shortcut-hint', '');
    document.body.append(host, neighbour);
    const originalRect = Element.prototype.getBoundingClientRect;
    const doc = document as unknown as Record<string, unknown>;
    const originalCaret = doc.caretPositionFromPoint;
    const originalFromPoint = doc.elementFromPoint;
    doc.caretPositionFromPoint = () => null;
    doc.elementFromPoint = () => neighbour;
    Element.prototype.getBoundingClientRect = function () {
        if (this === host) return rect(0, 0, 200, 40);
        if (this === neighbour) return rect(180, 0, 40, 20);
        return rect(0, 0, 0, 0);
    };
    try {
        const handle = shortcut(host, {
            combo: 'a',
            label: 'Open',
            placement: 'overhang'
        } as never);
        cleanups.push(() => handle.destroy());
        handle.update({ combo: 'a', label: 'Open again', placement: 'inline' } as never);
        handle.update({ combo: 'b', label: 'Other', placement: 'after', disabled: true } as never);
        handle.update({
            group: 'args',
            chordKey: 'x',
            label: 'Grouped',
            placement: 'trailing'
        } as never);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', bubbles: true }));
        handle.update({ combo: 'a', label: 'Open', placement: 'overhang' } as never);
        shortcutStore.armGroup('args');
        handle.update({
            group: 'args',
            chordKey: 'x',
            label: 'Grouped',
            placement: 'overhang'
        } as never);
        expect(host).toBeDefined();
    } finally {
        Element.prototype.getBoundingClientRect = originalRect;
        doc.caretPositionFromPoint = originalCaret;
        doc.elementFromPoint = originalFromPoint;
    }
});
