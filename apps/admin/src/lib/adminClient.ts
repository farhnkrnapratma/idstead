export interface AdminRequestOptions {
    params?: Record<string, string>;
    body?: unknown;
    signal?: AbortSignal;
    fallbackMessage?: string;
}

export const ACCESS_LOGOUT_URL = '/cdn-cgi/access/logout';

export const SESSION_EXPIRED_MESSAGE =
    'Your admin session has expired. Open the admin in a new tab to sign in again, then retry.';

export class AdminSessionExpiredError extends Error {
    constructor() {
        super(SESSION_EXPIRED_MESSAGE);
    }
}

export async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(input, {
        ...init,
        credentials: 'same-origin',
        redirect: 'manual'
    });
    if (response.type === 'opaqueredirect' || response.status === 401)
        throw new AdminSessionExpiredError();
    return response;
}

export async function adminRequest<T>(
    path: string,
    { params = {}, body, signal, fallbackMessage }: AdminRequestOptions = {}
): Promise<T> {
    const query = new URLSearchParams(params).toString();
    const response = await adminFetch(`/api/internal/admin/${path}${query ? `?${query}` : ''}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
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
