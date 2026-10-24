export const MAX_REDIRECT_URIS = 10;
export const MAX_REDIRECT_URI_LENGTH = 2000;
export const MAX_CLIENT_NAME_LENGTH = 80;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function base64Url(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomToken(byteLength = 32): string {
    return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export function generateClientId(): string {
    return randomToken(18);
}

export function generateClientSecret(): string {
    return randomToken(32);
}

export async function sha256Hex(value: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function redirectUriError(value: string): string | null {
    if (value.length > MAX_REDIRECT_URI_LENGTH) return 'is too long';
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return 'is not an absolute URL';
    }
    if (url.hash || value.includes('#')) return 'must not contain a fragment';
    if (url.username || url.password) return 'must not contain credentials';
    if (value.includes('*')) return 'must not contain wildcards';
    if (url.protocol === 'https:') return null;
    if (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)) return null;
    return 'must use https, or http on localhost';
}

export type ClientInput =
    { ok: true; name: string; redirectUris: string[] } | { ok: false; message: string };

export function parseClientInput(name: unknown, redirectUris: unknown): ClientInput {
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName || cleanName.length > MAX_CLIENT_NAME_LENGTH)
        return {
            ok: false,
            message: `The app name must be 1 to ${MAX_CLIENT_NAME_LENGTH} characters.`
        };
    if (!Array.isArray(redirectUris))
        return { ok: false, message: 'Redirect URIs must be a list.' };
    const uris = [
        ...new Set(
            redirectUris
                .filter((uri): uri is string => typeof uri === 'string')
                .map(uri => uri.trim())
                .filter(Boolean)
        )
    ];
    if (uris.length === 0 || uris.length > MAX_REDIRECT_URIS)
        return { ok: false, message: `Add between 1 and ${MAX_REDIRECT_URIS} redirect URIs.` };
    for (const uri of uris) {
        const problem = redirectUriError(uri);
        if (problem) return { ok: false, message: `The redirect URI ${uri} ${problem}.` };
    }
    return { ok: true, name: cleanName, redirectUris: uris };
}
