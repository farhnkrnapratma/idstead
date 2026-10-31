// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export interface OpenPgpUserId {
    name: string;
    email: string;
}

export interface OpenPgpKeyserver {
    label: string;
    url: string;
}

export interface PublicOpenPgpKey {
    fingerprint: string;
    userIds: OpenPgpUserId[];
    algorithm: string;
    createdAt: string | null;
    expiresAt: string | null;
    keyservers: OpenPgpKeyserver[];
    armored: string;
}

export const KEYSERVER_PRESETS = [
    {
        id: 'openpgp',
        label: 'keys.openpgp.org',
        url: (fingerprint: string) =>
            `https://keys.openpgp.org/vks/v1/by-fingerprint/${fingerprint}`
    },
    {
        id: 'ubuntu',
        label: 'keyserver.ubuntu.com',
        url: (fingerprint: string) =>
            `https://keyserver.ubuntu.com/pks/lookup?op=get&options=mr&search=0x${fingerprint}`
    }
] as const;

export function safeKeyserverUrl(value: unknown) {
    if (typeof value !== 'string' || value.length > 500) return null;
    if (!/^https:\/\/[A-Za-z0-9\-._~:/?#[\]@!&()*+,;=%]+$/.test(value)) return null;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password && url.href === value ?
                url.href
            :   null;
    } catch {
        return null;
    }
}

export function isFingerprint(value: unknown): value is string {
    return typeof value === 'string' && /^(?:[0-9A-F]{40}|[0-9A-F]{64})$/.test(value);
}

export function formatFingerprint(fingerprint: string) {
    return (
        fingerprint
            .toUpperCase()
            .match(/.{1,4}/g)
            ?.join(' ') ?? ''
    );
}

export function formatUserId({ name, email }: OpenPgpUserId) {
    return name && email ? `${name} <${email}>` : name || email;
}

const ZBASE32 = 'ybndrfg8ejkmcpqxot1uwisza345h769';

export function zbase32(bytes: Uint8Array) {
    let bits = 0;
    let value = 0;
    let out = '';
    for (const byte of bytes) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            out += ZBASE32[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) out += ZBASE32[(value << (5 - bits)) & 31];
    return out;
}

export async function wkdHash(localPart: string) {
    const digest = await crypto.subtle.digest(
        'SHA-1',
        new TextEncoder().encode(localPart.toLowerCase())
    );
    return zbase32(new Uint8Array(digest));
}

export function wkdEmails(userIds: OpenPgpUserId[], host: string) {
    const domain = host.toLowerCase().replace(/^www\./, '');
    return userIds
        .map(user => user.email.toLowerCase())
        .filter(
            email => /^[a-z0-9._%+-]+@[a-z0-9.-]+$/.test(email) && email.split('@')[1] === domain
        );
}

export function dearmor(armored: string) {
    const lines = armored.replace(/\r\n?/g, '\n').trim().split('\n');
    const begin = lines.findIndex(line => /^-----BEGIN PGP [A-Z ]+-----$/.test(line));
    const end = lines.findIndex(line => /^-----END PGP [A-Z ]+-----$/.test(line));
    if (begin < 0 || end <= begin) throw new Error('Not an armored OpenPGP block.');
    const body = lines.slice(begin + 1, end);
    const blank = body.findIndex(line => line.trim() === '');
    const data = (blank >= 0 ? body.slice(blank + 1) : body)
        .filter(line => !/^=[A-Za-z0-9+/]{4}$/.test(line))
        .join('');
    const binary = atob(data);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
}
