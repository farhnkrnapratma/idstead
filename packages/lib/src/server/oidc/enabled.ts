import * as privateEnv from '$app/env/private';

export function oidcEnabled(platform?: unknown): boolean {
    const value =
        (platform as { env?: Record<string, unknown> } | undefined)?.env?.OIDC_ENABLED
        ?? (privateEnv as Record<string, string | undefined>).OIDC_ENABLED
        ?? process.env.OIDC_ENABLED;
    return ['1', 'true'].includes(
        String(value ?? '')
            .trim()
            .toLowerCase()
    );
}
