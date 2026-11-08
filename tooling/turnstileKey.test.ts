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
} from '../tests/turnstileHarness.ts';

installHooks();

await load('site');

describe('turnstile with a configured site key', () => {
    test('renders on form focus and uses defaults for the action', async () => {
        const { turnstileWidget } = await load();
        const { api, calls } = fakeApi();
        win.turnstile = api;
        const node = mountForm();
        turnstileWidget(node, { sitekey: undefined as never });
        node.closest('form')!.dispatchEvent(new window.Event('focusin'));
        await flush();
        expect(calls.render[0]).toMatchObject({ sitekey: 'site', action: 'turnstile-spin-v2' });
    });

    test('forwards widget callbacks and styles the node', async () => {
        const { turnstileWidget, executeTurnstile } = await load();
        const { api, calls } = fakeApi();
        win.turnstile = api;
        scope.IntersectionObserver = undefined;
        const seen: string[] = [];
        const node = mountForm();
        turnstileWidget(node, {
            sitekey: 'key',
            'before-interactive-callback': () => void seen.push('before'),
            'after-interactive-callback': () => void seen.push('after'),
            callback: token => void seen.push('token:' + token),
            'error-callback': () => void seen.push('error'),
            'expired-callback': () => void seen.push('expired'),
            'timeout-callback': () => void seen.push('timeout')
        });
        await flush();
        const options = calls.render[0];
        options['before-interactive-callback']!();
        expect(node.style.opacity).toBe('1');
        expect(node.style.minHeight).toBe('65px');
        options['after-interactive-callback']!();
        expect(node.style.opacity).toBe('0');
        options['expired-callback']!();
        options.callback!('plain');

        for (const [name, expected] of [
            ['callback', 'tok'],
            ['error-callback', ''],
            ['timeout-callback', '']
        ] as const) {
            const pending = executeTurnstile(node);
            await flush();
            if (name === 'callback') options.callback!('tok');
            else (options[name] as (value?: unknown) => void)('x');
            expect(await pending).toBe(expected);
        }
        expect(seen).toEqual([
            'before',
            'after',
            'expired',
            'token:plain',
            'token:tok',
            'error',
            'timeout'
        ]);
        expect(calls.execute).toHaveLength(3);
    });

    test('resolves pending executions when the script fails', async () => {
        const { turnstileWidget, executeTurnstile } = await load();
        const node = mountForm();
        scope.IntersectionObserver = undefined;
        const errors: unknown[] = [];
        const logged = console.error;
        console.error = () => {};
        try {
            turnstileWidget(node, {
                sitekey: 'key',
                'error-callback': error => void errors.push(error)
            });
            const pending = executeTurnstile(node);
            await flush();
            document.head.querySelector('script')!.dispatchEvent(new window.Event('error'));
            expect(await pending).toBe('');
        } finally {
            console.error = logged;
        }
        expect(errors.length).toBeGreaterThan(0);
    });

    test('returns an existing response', async () => {
        const { executeTurnstile } = await load();
        const { api, state } = fakeApi();
        state.response = 'cached';
        win.turnstile = api;
        expect(await executeTurnstile(mountForm())).toBe('cached');
    });

    test('returns nothing when the script cannot load', async () => {
        const { executeTurnstile } = await load();
        const logged = console.error;
        console.error = () => {};
        try {
            const pending = executeTurnstile(mountForm());
            await flush();
            document.head.querySelector('script')!.dispatchEvent(new window.Event('error'));
            expect(await pending).toBe('');
        } finally {
            console.error = logged;
        }
    });

    test('renders without executing when configured', async () => {
        const { executeTurnstile, turnstileWidget } = await load();
        const { api, calls, state } = fakeApi();
        state.response = '';
        win.turnstile = api;
        scope.IntersectionObserver = undefined;
        const node = mountForm();
        turnstileWidget(node, { sitekey: 'key', execution: 'render' });
        await flush();
        const pending = executeTurnstile(node);
        await flush();
        calls.render[0].callback!('rendered');
        expect(await pending).toBe('rendered');
        expect(calls.execute).toHaveLength(0);
    });

    test('resolves empty when execution throws', async () => {
        const { executeTurnstile } = await load();
        const { api, state } = fakeApi();
        state.response = '';
        state.throwExecute = true;
        win.turnstile = api;
        expect(await executeTurnstile(mountForm())).toBe('');
    });

    test('falls back to the stored response on timeout', async () => {
        const { executeTurnstile } = await load();
        const { api, state } = fakeApi();
        state.response = '';
        win.turnstile = api;
        const node = mountForm();
        const pending = executeTurnstile(node);
        await flush();
        state.response = 'late';
        timers.at(-1)!();
        expect(await pending).toBe('late');
        const again = executeTurnstile(node);
        await flush();
        state.response = '';
        timers.at(-1)!();
        expect(await again).toBe('late');
    });

    test('timeout does nothing once resolved and handles a missing API', async () => {
        const { executeTurnstile } = await load();
        const { api, state } = fakeApi();
        state.response = '';
        win.turnstile = api;
        const node = mountForm();
        const pending = executeTurnstile(node);
        await flush();
        delete win.turnstile;
        timers.at(-1)!();
        expect(await pending).toBe('');
    });
});
