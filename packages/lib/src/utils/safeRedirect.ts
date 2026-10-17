const REDIRECT_BASE = 'https://admin.invalid';

export function getSafeRedirectUrl(target: string | null | undefined, fallback = '/'): string {
    const trimmed = target?.trim();
    if (!trimmed?.startsWith('/') || trimmed.includes('\0')) return fallback;
    let url: URL;
    try {
        url = new URL(trimmed, REDIRECT_BASE);
    } catch {
        return fallback;
    }
    if (url.origin !== REDIRECT_BASE) return fallback;
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/login')) return fallback;
    const result = url.pathname + url.search + url.hash;
    if (result.startsWith('//') || new URL(result, REDIRECT_BASE).origin !== REDIRECT_BASE)
        return fallback;
    return result;
}
