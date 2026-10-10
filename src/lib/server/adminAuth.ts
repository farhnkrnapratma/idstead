import type { SupabaseClient } from '@supabase/supabase-js';
import { requiresAdminMfa } from '#lib/adminAuthState.ts';

export type AdminAuth =
    | { actor: string; status?: never; message?: never }
    | { actor?: never; status: 401 | 403; message: string };

const ADMIN_ROLES = ['admin', 'service_role'];

/**
 * Resolves the assurance level from the Auth server rather than from local
 * session state. Passing the token explicitly makes supabase-js re-fetch the
 * user, so the verified-factor list comes from the network and not from a
 * cookie the caller controls.
 */
export async function isMfaSatisfied(
    client: SupabaseClient,
    accessToken: string
): Promise<boolean> {
    const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel(accessToken);
    if (error || !data) return false;
    return !requiresAdminMfa(data);
}

export function bearerToken(request: Request): string {
    return request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? '';
}

export async function verifyAdminToken(request: Request, db: SupabaseClient): Promise<AdminAuth> {
    const token = bearerToken(request);
    if (!token) return { status: 401, message: 'Admin authentication is required.' };

    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user)
        return { status: 401, message: 'Your session has expired. Log in again.' };

    if (!ADMIN_ROLES.includes(data.user.app_metadata?.role))
        return { status: 403, message: 'Admin privileges are required.' };

    if (!(await isMfaSatisfied(db, token)))
        return { status: 403, message: 'Complete two-factor verification before continuing.' };

    return { actor: data.user.id };
}
