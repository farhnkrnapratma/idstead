export const API_VERSION_PATH = '/v1';

export function apiBaseUrl(configured?: string | null): string {
    const base = configured?.trim();
    if (!base) throw new Error('PUBLIC_API_BASE_URL is not configured.');
    return base.replace(/\/+$/, '');
}

export function apiUrl(path = '', configured?: string | null): string {
    return `${apiBaseUrl(configured)}${API_VERSION_PATH}${path}`;
}
