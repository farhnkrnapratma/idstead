import * as privateEnv from '$app/env/private';

type PlatformEnv = { env?: { TURNSTILE_SECRET?: string } };

interface SiteverifyResponse {
    success: boolean;
    'error-codes'?: string[];
}

function isPublicIp(ip: string | undefined | null): boolean {
    if (!ip) return false;
    const clean = ip.trim().toLowerCase();
    if (
        clean === '127.0.0.1'
        || clean === '::1'
        || clean === 'localhost'
        || clean.startsWith('10.')
        || clean.startsWith('192.168.')
        || clean.startsWith('169.254.')
        || clean.startsWith('fe80:')
        || clean.startsWith('fc00:')
        || clean.startsWith('fd00:')
    ) {
        return false;
    }
    const match172 = clean.match(/^172\.(\d+)\./);
    if (match172) {
        const octet = parseInt(match172[1], 10);
        if (octet >= 16 && octet <= 31) return false;
    }
    return true;
}

export async function verifyTurnstileToken(
    token: string | undefined | null,
    remoteip: string,
    platform: unknown
): Promise<boolean> {
    if (!token) return false;

    const secret =
        (platform as PlatformEnv | undefined)?.env?.TURNSTILE_SECRET
        ?? privateEnv.TURNSTILE_SECRET
        ?? process.env.TURNSTILE_SECRET;

    if (!secret) {
        console.error('TURNSTILE_SECRET is not configured.');
        return false;
    }

    try {
        const formData = new URLSearchParams({ secret, response: token });
        if (remoteip && isPublicIp(remoteip)) {
            formData.set('remoteip', remoteip);
        }

        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });

        if (!res.ok) return false;

        const result = (await res.json()) as SiteverifyResponse;
        return result.success === true;
    } catch (err) {
        console.error('Turnstile siteverify request failed:', err);
        return false;
    }
}
