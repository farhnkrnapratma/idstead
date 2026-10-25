export const API_VERSIONS = ['v1'] as const;
export type ApiVersion = (typeof API_VERSIONS)[number];
export const LATEST_API_VERSION: ApiVersion = API_VERSIONS[API_VERSIONS.length - 1];
const API_VERSION_PATH = `/${LATEST_API_VERSION}`;

export function apiBaseUrl(configured?: string | null): string {
    const base = configured?.trim();
    if (!base) throw new Error('PUBLIC_API_BASE_URL is not configured.');
    return base.replace(/\/+$/, '');
}

export function apiVersionUrl(version: ApiVersion, configured?: string | null): string {
    return `${apiBaseUrl(configured)}/${version}`;
}

export function apiUrl(path = '', configured?: string | null): string {
    return `${apiBaseUrl(configured)}${API_VERSION_PATH}${path}`;
}
