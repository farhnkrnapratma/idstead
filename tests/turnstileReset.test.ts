import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

mock.module('$app/env/public', () => ({ PUBLIC_TURNSTILE_SITE_KEY: 'site-key' }));

const { resetTurnstile, turnstileWidget } = await import('../packages/lib/src/utils/turnstile.ts');

const globals = globalThis as unknown as Record<string, unknown>;
const saved = { window: globals.window, document: globals.document };
let resetCalls: unknown[] = [];

function fakeNode() {
    return { style: {}, innerHTML: '', closest: () => null } as unknown as HTMLElement;
}

beforeEach(() => {
    resetCalls = [];
    globals.document = {};
    globals.window = {
        turnstile: {
            render: () => 'widget-1',
            execute: () => {},
            reset: (target: unknown) => {
                resetCalls.push(target);
                if (typeof target !== 'string') {
                    throw new Error('Nothing to reset found for provided container');
                }
            },
            remove: () => {},
            getResponse: () => undefined
        }
    };
});

afterEach(() => {
    globals.window = saved.window;
    globals.document = saved.document;
});

describe('resetTurnstile', () => {
    test('does nothing for a container whose widget never rendered', () => {
        expect(() => resetTurnstile(fakeNode())).not.toThrow();
        expect(resetCalls).toEqual([]);
    });

    test('resets a rendered widget by its id', async () => {
        const node = fakeNode();
        turnstileWidget(node, { sitekey: 'site-key' });
        await Promise.resolve();
        await Promise.resolve();
        resetTurnstile(node);
        expect(resetCalls).toEqual(['widget-1']);
    });

    test('skips containers whose widget was destroyed', async () => {
        const node = fakeNode();
        const action = turnstileWidget(node, { sitekey: 'site-key' });
        await Promise.resolve();
        await Promise.resolve();
        action.destroy();
        expect(() => resetTurnstile(node)).not.toThrow();
        expect(resetCalls).toEqual([]);
    });
});
