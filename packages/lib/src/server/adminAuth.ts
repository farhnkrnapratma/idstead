// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { accessIdentity, type AccessIdentity } from './accessAuth';

export type AdminAuth =
    | { actor: string; authTime: number; status?: never; message?: never; code?: never }
    | { actor?: never; status: 401 | 403; message: string; code?: string };

export async function verifyAdminRequest(request: Request, platform?: unknown): Promise<AdminAuth> {
    const identity = await accessIdentity(request, platform);
    if (!identity)
        return {
            status: 401,
            code: 'ADMIN_AUTH_REQUIRED',
            message: 'Sign in through Cloudflare Access to continue.'
        };
    return { actor: identity.email, authTime: identity.authTime };
}

export async function adminActor(request: Request, platform?: unknown): Promise<string | null> {
    return (await accessIdentity(request, platform))?.email ?? null;
}

export type { AccessIdentity as AdminIdentity };
