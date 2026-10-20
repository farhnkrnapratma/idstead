import { adminRequest } from './adminClient';

export function adminActivityRequest<T>(
    path: 'notifications' | 'activity' | 'workspace',
    params: Record<string, string> = {},
    body?: unknown,
    signal?: AbortSignal
): Promise<T> {
    return adminRequest<T>(path, {
        params,
        body,
        signal,
        fallbackMessage: 'Activity is temporarily unavailable.'
    });
}
