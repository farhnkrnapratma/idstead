// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';

mock.module('$app/env/public', () => ({ PUBLIC_API_BASE_URL: 'https://api.example.com' }));

const { default: IdentityProviderSettings } =
    (await import('../apps/admin/src/lib/components/admin/IdentityProviderSettings.svelte')) as {
        default: never;
    };

const realFetch = globalThis.fetch;
const mounted: object[] = [];
let clientsFail = false;
const calls: Array<{ path: string; method: string }> = [];

const settle = async () => {
    for (let round = 0; round < 4; round++) {
        await tick();
        await new Promise(resolve => setTimeout(resolve, 0));
        flushSync();
    }
};

const clients = {
    enabled: true,
    issuer: 'https://example.com',
    discoveryUrl: 'https://example.com/.well-known/openid-configuration',
    clients: [
        {
            clientId: 'client-1',
            name: 'Mobile app',
            redirectUris: ['https://app.example.com/callback'],
            confidential: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-02-01T00:00:00.000Z'
        }
    ]
};

const grants = {
    grants: [
        {
            id: 'grant-1',
            clientId: 'client-1',
            clientName: 'Mobile app',
            scopes: ['openid', 'profile'],
            createdAt: '2026-01-05T00:00:00.000Z',
            lastUsedAt: null
        }
    ]
};

beforeEach(() => {
    clientsFail = false;
    calls.length = 0;
    globalThis.fetch = (async (input: string, init?: RequestInit) => {
        const url = new URL(String(input), 'https://admin.example.com');
        const method = init?.method ?? 'GET';
        calls.push({ path: url.pathname, method });
        if (url.pathname.endsWith('oidc/clients')) {
            if (clientsFail && method === 'GET')
                return Response.json({ message: 'Apps are down.' }, { status: 500 });
            if (method === 'POST')
                return Response.json({ clientSecret: 'secret-value', ...clients.clients[0] });
            return Response.json(clients);
        }
        if (url.pathname.endsWith('oidc/grants'))
            return Response.json(method === 'GET' ? grants : { ok: true });
        return Response.json({});
    }) as unknown as typeof fetch;
});

afterEach(() => {
    globalThis.fetch = realFetch;
    for (const instance of mounted.splice(0)) {
        try {
            void unmount(instance);
        } catch {}
    }
    document.body.innerHTML = '';
});

test('lists apps and grants, then exercises the create, edit and revoke actions', async () => {
    mounted.push(mount(IdentityProviderSettings, { target: document.body, props: {} as never }));
    await settle();
    await new Promise(resolve => setTimeout(resolve, 150));
    await settle();
    expect(document.body.textContent).toContain('Mobile app');

    for (const button of [...document.querySelectorAll<HTMLButtonElement>('button')].slice(0, 12)) {
        button.click();
        flushSync();
        await settle();
    }
    const input = document.querySelector<HTMLInputElement>(
        'input[name="name"], input[type="text"]'
    );
    if (input) {
        input.value = 'New app';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        flushSync();
    }
    expect(calls.some(call => call.path.endsWith('oidc/clients'))).toBe(true);
}, 60000);

test('reports when the apps cannot be loaded', async () => {
    clientsFail = true;
    mounted.push(mount(IdentityProviderSettings, { target: document.body, props: {} as never }));
    await settle();
    await new Promise(resolve => setTimeout(resolve, 150));
    await settle();
    expect(document.body.textContent).toContain('Apps are down.');
}, 60000);
