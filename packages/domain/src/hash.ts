// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export async function sha256Hex(text: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function hashIp(ip: string, salt: string): Promise<string> {
    return sha256Hex(ip + salt);
}

export function versionToken(version: string): string {
    let first = 0x811c9dc5;
    let second = 0x9e3779b9;
    for (let index = 0; index < version.length; index++) {
        const code = version.charCodeAt(index);
        first = Math.imul(first ^ code, 0x01000193) >>> 0;
        second = Math.imul(second ^ code, 0x5bd1e995) >>> 0;
    }
    return first.toString(36).padStart(7, '0') + second.toString(36).padStart(7, '0');
}

export async function identityVersionToken(version: unknown): Promise<string | null> {
    if (typeof version !== 'string' || !version) return null;
    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(`identity-version:${version}`)
    );
    return Array.from(new Uint8Array(digest).slice(0, 8), byte =>
        byte.toString(16).padStart(2, '0')
    ).join('');
}
