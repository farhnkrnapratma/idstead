export function getSafeRedirectUrl(target: string | null | undefined, fallback = '/'): string {
    if (!target) return fallback;
    const trimmed = target.trim();
    if (
        !trimmed.startsWith('/')
        || trimmed.startsWith('//')
        || trimmed.startsWith('/api/')
        || trimmed.startsWith('/login')
        || trimmed.includes('\\')
        || trimmed.includes('://')
        || trimmed.includes('\0')
    ) {
        return fallback;
    }
    return trimmed;
}
