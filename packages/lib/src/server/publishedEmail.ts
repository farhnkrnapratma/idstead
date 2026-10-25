function mailtoAddress(href: string): string | null {
    if (!href.toLowerCase().startsWith('mailto:')) return null;
    try {
        return decodeURIComponent(href.slice('mailto:'.length).split('?')[0]).trim().toLowerCase();
    } catch {
        return null;
    }
}

export function publishedEmail(
    email: string | null | undefined,
    contact: Array<{ href: string }>
): string {
    const normalized = (email ?? '').trim().toLowerCase();
    if (!normalized) return '';
    return contact.some(link => mailtoAddress(link.href) === normalized) ? normalized : '';
}
