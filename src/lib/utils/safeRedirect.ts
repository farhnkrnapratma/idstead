export function getSafeRedirectUrl(
  target: string | null | undefined,
  fallback = '/admin'
): string {
  if (!target) return fallback;
  const trimmed = target.trim();
  if (
    trimmed.startsWith('//')
    || trimmed.includes('\\')
    || trimmed.includes('://')
    || trimmed.includes('\0')
  ) {
    return fallback;
  }
  if (
    trimmed === '/admin'
    || trimmed.startsWith('/admin/')
    || trimmed.startsWith('/admin?')
  ) {
    return trimmed;
  }
  return fallback;
}
