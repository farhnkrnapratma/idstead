import { supabase } from '#lib/supabase.ts';

export interface AdminRequestOptions {
    params?: Record<string, string>;
    body?: unknown;
    signal?: AbortSignal;
    fallbackMessage?: string;
}

export async function adminRequest<T>(
    path: string,
    { params = {}, body, signal, fallbackMessage }: AdminRequestOptions = {}
): Promise<T> {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw new Error('Your session has expired. Log in again.');
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`/api/internal/admin/${path}${query ? `?${query}` : ''}`, {
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
            result?.error?.message
                ?? result?.message
                ?? fallbackMessage
                ?? 'The admin service is temporarily unavailable.'
        );
    return result as T;
}
