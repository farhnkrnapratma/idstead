// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { SpotlightCommandContext } from '../apps/web/src/lib/components/spotlight/context.ts';
import type { SpotlightItem } from '../apps/web/src/lib/components/spotlight/types.ts';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));

import { page } from '$app/state';

const { createDefaultCommands } =
    await import('../apps/web/src/lib/components/spotlight/defaultCommands.ts');

type Call = { name: string; args: unknown[] };

let calls: Call[] = [];
let ctx: SpotlightCommandContext;
let items: SpotlightItem[];

const realPrint = window.print;

function recorder(): SpotlightCommandContext {
    const record =
        (name: string) =>
        (...args: unknown[]) =>
            void calls.push({ name, args });
    return {
        close: record('close'),
        setHelp: record('setHelp'),
        openShare: record('openShare'),
        openQr: record('openQr'),
        requestMailing: record('requestMailing')
    };
}

function action(id: string): () => void {
    const item = items.find(entry => entry.id === id);
    if (!item?.action) throw new Error(`no action for ${id}`);
    return item.action;
}

beforeEach(() => {
    calls = [];
    ctx = recorder();
    items = createDefaultCommands(ctx);
});

afterEach(() => {
    window.print = realPrint;
});

describe('default spotlight commands', () => {
    test('exposes the page commands as links without actions', () => {
        const home = items.find(entry => entry.id === 'cmd-home');
        expect(home).toMatchObject({ url: '/', badge: 'Page' });
        expect(home?.action).toBeUndefined();
        expect(items.find(entry => entry.id === 'cmd-mailing')).toMatchObject({
            requiresArgs: true,
            validArgs: ['subscribe', 'unsubscribe']
        });
    });

    test('closes the palette and opens the share, QR and help panels', () => {
        action('cmd-share')();
        expect(calls).toEqual([{ name: 'openShare', args: [] }]);

        calls = [];
        action('cmd-qr')();
        expect(calls).toEqual([{ name: 'openQr', args: [] }]);

        calls = [];
        action('cmd-keyboard')();
        expect(calls.map(call => call.name)).toEqual(['setHelp', 'close']);
        expect(calls[0].args).toEqual([false]);

        calls = [];
        action('cmd-help')();
        expect(calls).toEqual([{ name: 'setHelp', args: [true] }]);
    });

    test('goes back and forward through history and reports an empty history', () => {
        const back = window.history.back;
        const forward = window.history.forward;
        const went: string[] = [];
        window.history.back = () => void went.push('back');
        window.history.forward = () => void went.push('forward');
        const length = Object.getOwnPropertyDescriptor(window.history, 'length');
        try {
            Object.defineProperty(window.history, 'length', { configurable: true, get: () => 1 });
            action('cmd-back')();
            expect(went).toEqual([]);
            Object.defineProperty(window.history, 'length', { configurable: true, get: () => 2 });
            action('cmd-back')();
            expect(went).toEqual(['back']);
            action('cmd-forward')();
            expect(went).toEqual(['back', 'forward']);
            expect(calls.filter(call => call.name === 'close')).toHaveLength(3);
        } finally {
            window.history.back = back;
            window.history.forward = forward;
            if (length) Object.defineProperty(window.history, 'length', length);
            else delete (window.history as { length?: number }).length;
        }
    });

    test('scrolls to the top and bottom of the page', async () => {
        action('cmd-top')();
        action('cmd-bottom')();
        await new Promise(resolve => setTimeout(resolve, 80));
        expect(calls.filter(call => call.name === 'close')).toHaveLength(2);
    });

    test('prints the page after the palette closes', async () => {
        let printed = 0;
        window.print = () => void printed++;
        action('cmd-print')();
        expect(calls.map(call => call.name)).toEqual(['close']);
        await new Promise(resolve => setTimeout(resolve, 200));
        expect(printed).toBe(1);
    });

    test('opens cookie preferences and reading mode', () => {
        action('cmd-cookies')();
        expect(calls.map(call => call.name)).toEqual(['close']);
        calls = [];
        action('cmd-read')();
        expect(calls.map(call => call.name)).toEqual(['close']);
        (page as unknown as { url: URL }).url = new URL('https://dom.test/blog/hello');
        calls = [];
        action('cmd-read')();
        expect(calls.map(call => call.name)).toEqual(['close']);
        (page as unknown as { url: URL }).url = new URL('https://dom.test/');
    });

    test('reloads the page and tries to leave it on exit', () => {
        const reload = window.location.reload;
        let reloads = 0;
        window.location.reload = () => void reloads++;
        try {
            action('cmd-refresh')();
            expect(reloads).toBe(1);
        } finally {
            window.location.reload = reload;
        }
        expect(() => action('cmd-exit')()).not.toThrow();
    });
});
