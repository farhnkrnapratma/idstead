export const API_VERSION_PATH = '/v1';
export const DEFAULT_API_BASE_URL = 'https://api.fkp.my.id';

export function apiBaseUrl(configured?: string | null): string {
    return (configured?.trim() || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
}

export function apiUrl(path = '', configured?: string | null): string {
    return `${apiBaseUrl(configured)}${API_VERSION_PATH}${path}`;
}
