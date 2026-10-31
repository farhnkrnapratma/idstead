// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { shortcutStore } from '../stores/shortcutStore.svelte';

export function focusScope(node: HTMLElement, scope: string) {
    let current = scope;
    let pushed: string | null = null;
    let focused = false;
    let hovered = false;
    let destroyed = false;
    let queued = false;

    const apply = () => {
        queued = false;
        const want = !destroyed && (focused || hovered) ? current : null;
        if (want === pushed) return;
        if (pushed) shortcutStore.popScope(pushed);
        if (want) shortcutStore.pushScope(want);
        pushed = want;
    };

    const schedule = () => {
        if (queued) return;
        queued = true;
        queueMicrotask(apply);
    };

    const onFocusIn = (e: FocusEvent) => {
        const target = e.target;
        focused = !(target instanceof Element) || target.closest('[data-focus-scope]') === node;
        schedule();
    };

    const onFocusOut = (e: FocusEvent) => {
        const next = e.relatedTarget;
        if (next instanceof Node && node.contains(next)) return;
        focused = false;
        schedule();
    };

    const onEnter = () => {
        hovered = true;
        schedule();
    };

    const onLeave = () => {
        hovered = false;
        schedule();
    };

    node.dataset.focusScope = '';
    node.addEventListener('focusin', onFocusIn);
    node.addEventListener('focusout', onFocusOut);
    node.addEventListener('pointerenter', onEnter);
    node.addEventListener('pointerleave', onLeave);

    return {
        update(next: string) {
            if (next === current) return;
            current = next;
            schedule();
        },
        destroy() {
            destroyed = true;
            node.removeEventListener('focusin', onFocusIn);
            node.removeEventListener('focusout', onFocusOut);
            node.removeEventListener('pointerenter', onEnter);
            node.removeEventListener('pointerleave', onLeave);
            schedule();
        }
    };
}
