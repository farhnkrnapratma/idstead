// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { load } from '../apps/admin/src/routes/(admin)/oauth/authorize/+page.server.ts';

describe('OAuth authorize page loader', () => {
    test('explains that sign-in is not set up without OIDC configuration', async () => {
        const result = (await load({
            url: new URL('https://admin.example.com/oauth/authorize?client_id=x'),
            platform: {},
            locals: { getAdmin: async () => null },
            setHeaders: () => {}
        } as never)) as { outcome: { kind: string; message: string }; query: string };
        expect(result.outcome).toEqual({
            kind: 'fatal',
            message: 'Sign in with Idstead is not set up on this site.'
        });
        expect(result.query).toBe('');
    });
});
