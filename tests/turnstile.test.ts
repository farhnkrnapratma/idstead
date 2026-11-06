// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    FakeObserver,
    fakeApi,
    flush,
    installHooks,
    load,
    mountForm,
    scope,
    timers,
    win
} from './turnstileHarness.ts';

installHooks();

describe('ensureTurnstileScript', () => {
    test('rejects outside a browser', async () => {
        const { ensureTurnstileScript } = await load();
        const saved = scope.document;
        scope.document = undefined;
        try {
            await expect(ensureTurnstileScript()).rejects.toThrow('only load in a browser');
        } finally {
            scope.document = saved;
        }
    });

    test('resolves immediately when the API exists', async () => {
        const { ensureTurnstileScript } = await load();
        win.turnstile = fakeApi().api;
        await ensureTurnstileScript();
        expect(document.head.querySelector('script')).toBeNull();
    });

    test('injects the script once and resolves on load', async () => {
        const { ensureTurnstileScript } = await load();
        const first = ensureTurnstileScript();
        expect(ensureTurnstileScript()).toBe(first);
        const script = document.head.querySelector('script')!;
        expect(script.src).toContain('challenges.cloudflare.com/turnstile');
        win.turnstile = fakeApi().api;
        script.dispatchEvent(new window.Event('load'));
        await first;
    });

    test('reuses an existing script element', async () => {
        const { ensureTurnstileScript } = await load();
        document.head.innerHTML =
            '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>';
        const promise = ensureTurnstileScript();
        expect(document.head.querySelectorAll('script')).toHaveLength(1);
        win.turnstile = fakeApi().api;
        document.head.querySelector('script')!.dispatchEvent(new window.Event('load'));
        await promise;
    });

    test('rejects when loaded without the API and then retries', async () => {
        const { ensureTurnstileScript } = await load();
        const first = ensureTurnstileScript();
        document.head.querySelector('script')!.dispatchEvent(new window.Event('load'));
        await expect(first).rejects.toThrow('without exposing its API');
        expect(document.head.querySelector('script')).toBeNull();
        const second = ensureTurnstileScript();
        expect(second).not.toBe(first);
        second.catch(() => {});
    });

    test('rejects on a script error', async () => {
        const { ensureTurnstileScript } = await load();
        const promise = ensureTurnstileScript();
        document.head.querySelector('script')!.dispatchEvent(new window.Event('error'));
        await expect(promise).rejects.toThrow('Failed to load');
    });

    test('rejects on timeout', async () => {
        const { ensureTurnstileScript } = await load();
        const promise = ensureTurnstileScript();
        timers[0]();
        await expect(promise).rejects.toThrow('Timed out');
    });
});

describe('turnstileWidget', () => {
    test('renders lazily once the form becomes visible', async () => {
        const { turnstileWidget } = await load();
        const { api, calls } = fakeApi();
        win.turnstile = api;
        const node = mountForm();
        const widget = turnstileWidget(node, { sitekey: ' key ', action: 'login' });
        expect(node.style.opacity).toBe('0');
        FakeObserver.last!.callback([{ isIntersecting: false }]);
        await flush();
        expect(calls.render).toHaveLength(0);
        FakeObserver.last!.callback([{ isIntersecting: true }]);
        await flush();
        expect(calls.render[0]).toMatchObject({
            sitekey: 'key',
            action: 'login',
            size: 'flexible',
            theme: 'auto',
            appearance: 'interaction-only',
            execution: 'execute'
        });
        expect(FakeObserver.last!.disconnected).toBe(true);
        widget.destroy();
        expect(calls.remove).toEqual(['widget-1']);
    });

    test('renders immediately without IntersectionObserver', async () => {
        const { turnstileWidget } = await load();
        const { api, calls } = fakeApi();
        win.turnstile = api;
        scope.IntersectionObserver = undefined;
        turnstileWidget(mountForm(), { sitekey: 'key', appearance: 'always' });
        await flush();
        expect(calls.render).toHaveLength(1);
        expect(calls.render[0].appearance).toBe('always');
    });

    test('skips rendering without a site key', async () => {
        const { turnstileWidget } = await load();
        const { api, calls } = fakeApi();
        win.turnstile = api;
        scope.IntersectionObserver = undefined;
        turnstileWidget(mountForm(), { sitekey: '  ' });
        await flush();
        expect(calls.render).toHaveLength(0);
    });

    test('skips rendering after destruction', async () => {
        const { turnstileWidget } = await load();
        const { api, calls } = fakeApi();
        win.turnstile = api;
        const widget = turnstileWidget(mountForm(), { sitekey: 'key' });
        widget.destroy();
        FakeObserver.last!.callback([{ isIntersecting: true }]);
        await flush();
        expect(calls.render).toHaveLength(0);
        expect(calls.remove).toEqual([document.getElementById('slot')]);
    });

    test('logs render errors', async () => {
        const { turnstileWidget } = await load();
        const { api, state } = fakeApi();
        state.throwRender = true;
        win.turnstile = api;
        scope.IntersectionObserver = undefined;
        const logged: unknown[] = [];
        const error = console.error;
        console.error = (...args: unknown[]) => void logged.push(args);
        try {
            turnstileWidget(mountForm(), { sitekey: 'key' });
            await flush();
        } finally {
            console.error = error;
        }
        expect(logged).toHaveLength(1);
    });

    test('reports a vanished API through the error callback', async () => {
        const { turnstileWidget } = await load();
        const { api } = fakeApi();
        let reads = 0;
        Object.defineProperty(window, 'turnstile', {
            configurable: true,
            get: () => (++reads <= 2 ? api : undefined)
        });
        scope.IntersectionObserver = undefined;
        const errors: unknown[] = [];
        const logged = console.error;
        console.error = () => {};
        try {
            turnstileWidget(mountForm(), {
                sitekey: 'key',
                'error-callback': error => void errors.push(error)
            });
            await flush();
        } finally {
            console.error = logged;
            Object.defineProperty(window, 'turnstile', {
                configurable: true,
                writable: true,
                value: undefined
            });
        }
        expect(errors).toHaveLength(1);
    });

    test('tolerates removal failures on destroy', async () => {
        const { turnstileWidget } = await load();
        const { api, calls } = fakeApi();
        win.turnstile = api;
        scope.IntersectionObserver = undefined;
        const node = mountForm();
        const widget = turnstileWidget(node, { sitekey: 'key' });
        await flush();
        api.remove = () => {
            throw new Error('x');
        };
        widget.destroy();
        const other = turnstileWidget(mountForm(), { sitekey: '' });
        api.remove = () => {
            throw new Error('y');
        };
        other.destroy();
        expect(calls.render).toHaveLength(1);
    });
});

describe('executeTurnstile', () => {
    test('returns nothing without a node or key', async () => {
        const unkeyed = await load();
        expect(await unkeyed.executeTurnstile(null)).toBe('');
        expect(await unkeyed.executeTurnstile(mountForm())).toBe('');
    });
});

describe('resetTurnstile', () => {
    test('ignores a missing node', async () => {
        const { resetTurnstile } = await load();
        resetTurnstile(null);
    });

    test('collapses interaction-only widgets', async () => {
        const { resetTurnstile, turnstileWidget } = await load();
        const { api, calls } = fakeApi();
        win.turnstile = api;
        scope.IntersectionObserver = undefined;
        const node = mountForm();
        turnstileWidget(node, { sitekey: 'key' });
        node.style.opacity = '1';
        resetTurnstile(node);
        expect(node.style.opacity).toBe('0');
        expect(calls.reset).toEqual([node]);
    });

    test('leaves always-visible widgets alone and tolerates a missing API', async () => {
        const { resetTurnstile, turnstileWidget } = await load();
        scope.IntersectionObserver = undefined;
        const node = mountForm();
        turnstileWidget(node, { sitekey: 'key', appearance: 'always' });
        node.style.opacity = '1';
        resetTurnstile(node);
        expect(node.style.opacity).toBe('1');
        const fresh = mountForm();
        resetTurnstile(fresh);
        expect(fresh.style.opacity).toBe('0');
    });
});
