// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, mock } from 'bun:test';

export type Turnstile = NonNullable<Window['turnstile']>;
export type Options = Parameters<Turnstile['render']>[1];

let counter = 0;
export async function load(siteKey?: string) {
    if (siteKey !== undefined)
        mock.module('$app/env/public', () => ({ PUBLIC_TURNSTILE_SITE_KEY: siteKey }));
    const loaded = await import(`../packages/lib/src/utils/turnstile.ts?case=${counter++}`);
    return loaded as typeof import('../packages/lib/src/utils/turnstile.ts');
}

export const scope = globalThis as unknown as Record<string, unknown>;
export const win = window as unknown as {
    turnstile?: unknown;
    setTimeout: unknown;
    clearTimeout: unknown;
};
const nativeSetTimeout = globalThis.setTimeout;
const nativeClearTimeout = globalThis.clearTimeout;
const nativeObserver = scope.IntersectionObserver;
const nativeCreate = document.createElement.bind(document);
export const timers: Array<() => void> = [];

function inertScripts() {
    document.createElement = ((name: string, options?: ElementCreationOptions) => {
        const element = nativeCreate(name, options);
        if (name.toLowerCase() === 'script') {
            let src = '';
            Object.defineProperty(element, 'src', {
                get: () => src,
                set: (value: string) => void (src = value)
            });
        }
        return element;
    }) as never;
}

export function fakeApi() {
    const calls = {
        render: [] as Options[],
        execute: [] as unknown[],
        remove: [] as unknown[]
    } as { render: Options[]; execute: unknown[]; remove: unknown[]; reset: unknown[] };
    calls.reset = [];
    const state = { response: '' as string | undefined, throwRender: false, throwExecute: false };
    const api: Turnstile = {
        render: (_node, options) => {
            if (state.throwRender) throw new Error('render failed');
            calls.render.push(options);
            return 'widget-1';
        },
        execute: node => {
            if (state.throwExecute) throw new Error('execute failed');
            calls.execute.push(node);
        },
        reset: node => void calls.reset.push(node),
        remove: node => {
            calls.remove.push(node);
            if (node === 'boom' || state.throwRender === undefined) throw new Error('remove');
        },
        getResponse: () => state.response
    };
    return { api, calls, state };
}

export class FakeObserver {
    static last: FakeObserver | undefined;
    disconnected = false;
    observed: unknown;
    callback: (entries: Array<{ isIntersecting: boolean }>) => void;
    init: unknown;
    constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void, init: unknown) {
        this.callback = callback;
        this.init = init;
        FakeObserver.last = this;
    }
    observe(target: unknown) {
        this.observed = target;
    }
    disconnect() {
        this.disconnected = true;
    }
}

export function mountForm() {
    document.body.innerHTML = '<form><div id="slot"></div></form>';
    return document.getElementById('slot') as HTMLElement;
}

export const flush = async () => {
    for (let index = 0; index < 5; index++) await Promise.resolve();
};

export function installHooks() {
    beforeEach(() => {
        timers.length = 0;
        win.setTimeout = scope.setTimeout = ((fn: () => void) => {
            timers.push(fn);
            return timers.length;
        }) as never;
        win.clearTimeout = scope.clearTimeout = (() => {}) as never;
        inertScripts();
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        delete win.turnstile;
        scope.IntersectionObserver = FakeObserver;
        FakeObserver.last = undefined;
    });

    afterEach(() => {
        document.createElement = nativeCreate as never;
        win.setTimeout = scope.setTimeout = nativeSetTimeout;
        win.clearTimeout = scope.clearTimeout = nativeClearTimeout;
        scope.IntersectionObserver = nativeObserver;
        delete win.turnstile;
    });
}
