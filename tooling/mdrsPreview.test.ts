// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, mock, test } from 'bun:test';

const state = { response: null as Response | null, failure: false, bodies: [] as unknown[] };

mock.module('../apps/admin/src/lib/adminClient.ts', () => ({
    adminFetch: async (path: string, init: RequestInit) => {
        expect(path).toBe('/api/internal/admin/mdrs-get');
        state.bodies.push(JSON.parse(String(init.body)));
        if (state.failure) throw new Error('offline');
        return state.response!.clone();
    }
}));

const { renderMdrsPreview } = await import('../apps/admin/src/lib/mdrsPreview.ts');

const doc = (url: string) => `:::define\nn: 1\n:::\n\n\${get('${url}', '.name')}`;

beforeEach(() => {
    state.response = null;
    state.failure = false;
    state.bodies = [];
});

describe('renderMdrsPreview', () => {
    test('fetches get() URLs through the admin proxy and caches them for a minute', async () => {
        state.response = Response.json({ data: { name: 'Ada' } });
        const url = 'https://api.example.com/v1/one';
        expect(await renderMdrsPreview(doc(url))).toContain('Ada');
        expect(await renderMdrsPreview(doc(url))).toContain('Ada');
        expect(state.bodies).toEqual([{ url }]);
    });

    test('shows the proxy error message and retries after a failure', async () => {
        const url = 'https://api.example.com/v1/two';
        state.response = Response.json(
            { error: { message: 'get() received HTTP 404 from x' } },
            { status: 502 }
        );
        expect(await renderMdrsPreview(doc(url))).toContain('get() received HTTP 404 from x');
        state.failure = true;
        expect(await renderMdrsPreview(doc(url))).toContain('get() is unavailable right now.');
        expect(state.bodies).toHaveLength(2);
    });
});
