// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { mock } from 'bun:test';

export const admin = {
    response: null as Response | null,
    authFailure: null as Response | null,
    service: undefined as unknown,
    logged: [] as Array<Record<string, any>>
};

mock.module('../../packages/lib/src/server/adminRequest.ts', () => ({
    requireAdminAuth: async () => admin.authFailure,
    requireSameOriginAdmin: async () => admin.authFailure,
    adminServices: async () =>
        admin.response ? { response: admin.response } : { service: admin.service },
    logAdminActivity: async (_r: Request, _p: unknown, entry: Record<string, any>) =>
        void admin.logged.push(entry)
}));
