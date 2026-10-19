import { supabase } from '#lib/supabase.ts';

export async function adminActivityRequest<T>(
    path: 'notifications' | 'activity' | 'workspace',
    params: Record<string, string> = {},
    body?: unknown,
    signal?: AbortSignal
): Promise<T> {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw new Error('Your session has expired. Log in again.');
    const response = await fetch(`/api/internal/admin/${path}?${new URLSearchParams(params)}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
            Authorization: `Bearer ${data.session.access_token}`,
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
        signal: signal ?? AbortSignal.timeout(15000)
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result === null)
        throw new Error(
            result?.error?.message ?? result?.message ?? 'Activity is temporarily unavailable.'
        );
    return result as T;
}
