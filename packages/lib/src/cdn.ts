import * as publicEnv from '$app/env/public';

export function cdnBaseUrl() {
    return String(publicEnv.PUBLIC_CDN_BASE_URL ?? '')
        .trim()
        .replace(/\/+$/, '');
}
