// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { createSubscriber } from 'svelte/reactivity';
import { on } from 'svelte/events';

class ReactiveVisualViewport {
    #subscribe = createSubscriber(update => {
        const viewport = typeof window === 'undefined' ? null : window.visualViewport;
        if (!viewport) return;
        const offResize = on(viewport, 'resize', update);
        const offScroll = on(viewport, 'scroll', update);
        return () => {
            offResize();
            offScroll();
        };
    });

    get height(): number | null {
        this.#subscribe();
        return typeof window === 'undefined' ? null : (window.visualViewport?.height ?? null);
    }

    get offsetTop(): number | null {
        this.#subscribe();
        return typeof window === 'undefined' ? null : (window.visualViewport?.offsetTop ?? null);
    }
}

export const visualViewport = new ReactiveVisualViewport();
