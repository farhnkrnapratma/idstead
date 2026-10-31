// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { createD1OidcAuthStore, createD1OidcClientStore } from '../packages/data/src/d1/oidc.ts';
import { oidcContract } from './contracts/oidc.contract.ts';
import { d1Shim } from './support/d1.ts';

oidcContract('D1 adapter', () => {
    const { db } = d1Shim();
    let offset = 0;
    const now = () => Date.now() + offset;
    return {
        clients: createD1OidcClientStore(db, now),
        auth: createD1OidcAuthStore(db, now),
        clock: { advance: ms => (offset += ms) }
    };
});
