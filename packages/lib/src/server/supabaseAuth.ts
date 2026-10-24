import { createServerClient } from '@supabase/ssr';
import type { RequestEvent } from '@sveltejs/kit';
import * as publicEnv from '$app/env/public';
import { requiresAdminMfa } from '#lib/adminAuthState.ts';

export type AuthClient = ReturnType<typeof createAuthClient>;

export interface AdminSession {
    id: string;
    email: string;
    role: string;
    aal: string;
    mfaSatisfied: boolean;
    authTime: number;
}

function projectUrl(): string {
    const raw = publicEnv.PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
    return raw.replace(/\/rest\/v1\/?$/, '');
}

export function createAuthClient(event: RequestEvent) {
    return createServerClient(
        projectUrl(),
        publicEnv.PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder-key',
        {
            cookies: {
                getAll: () => event.cookies.getAll(),
                setAll: cookies => {
                    for (const { name, value, options } of cookies)
                        event.cookies.set(name, value, {
                            ...options,
                            path: '/',
                            sameSite: 'lax',
                            secure: event.url.protocol === 'https:'
                        });
                }
            }
        }
    );
}

export function safeGetSession(client: AuthClient) {
    let cached: Promise<AdminSession | null> | null = null;
    return (): Promise<AdminSession | null> => {
        cached ??= resolveSession(client);
        return cached;
    };
}

function latestAuthentication(methods: unknown[]): number {
    const times = methods.map(method =>
        typeof (method as { timestamp?: unknown })?.timestamp === 'number' ?
            (method as { timestamp: number }).timestamp
        :   0
    );
    return Math.max(0, ...times);
}

async function resolveSession(client: AuthClient): Promise<AdminSession | null> {
    const {
        data: { user },
        error
    } = await client.auth.getUser();
    if (error || !user) return null;

    const {
        data: { session }
    } = await client.auth.getSession();
    const accessToken = session?.access_token ?? '';
    if (!accessToken) return null;

    const { data: levels, error: levelError } =
        await client.auth.mfa.getAuthenticatorAssuranceLevel(accessToken);
    if (levelError || !levels) return null;

    return {
        id: user.id,
        email: user.email ?? '',
        role: (user.app_metadata as { role?: string } | null)?.role ?? '',
        aal: levels.currentLevel ?? '',
        mfaSatisfied: !requiresAdminMfa(levels),
        authTime: latestAuthentication(levels.currentAuthenticationMethods ?? [])
    };
}
