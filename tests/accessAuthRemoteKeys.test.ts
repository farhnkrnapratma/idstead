// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import { verifyAccessToken } from '../packages/lib/src/server/accessAuth.ts';

const config = {
    teamDomain: 'team.example.com',
    audience: 'aud-tag',
    adminEmails: ['ada@example.org']
};

test('rejects tokens that are not signed JWTs without reaching the team key set', async () => {
    expect(await verifyAccessToken('not-a-token', config as never)).toBeNull();
    expect(await verifyAccessToken('a.b.c', config as never)).toBeNull();
});
