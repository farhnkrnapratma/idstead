import { createHash } from 'node:crypto';

const SHA256_HASH = /^[0-9a-f]{64}$/;
const MD5_HASH = /^[0-9a-f]{32}$/;

export const DEFAULT_AVATAR_SIZE = 80;

const AVATAR_FILES: Array<[number, string]> = [
    [16, 'favicon-16x16.png'],
    [32, 'favicon-32x32.png'],
    [180, 'apple-touch-icon.png'],
    [192, 'android-chrome-192x192.png'],
    [512, 'avatar.png']
];

export function emailHashMatches(hash: string, email: string): boolean {
    const value = hash.trim().toLowerCase();
    const normalized = email.trim().toLowerCase();
    if (!normalized) return false;
    if (SHA256_HASH.test(value))
        return createHash('sha256').update(normalized).digest('hex') === value;
    if (MD5_HASH.test(value)) return createHash('md5').update(normalized).digest('hex') === value;
    return false;
}

export function requestedAvatarSize(params: URLSearchParams): number {
    const raw = params.get('s') ?? params.get('size');
    const size = raw === null ? DEFAULT_AVATAR_SIZE : Number.parseInt(raw, 10);
    if (!Number.isFinite(size) || size < 1) return DEFAULT_AVATAR_SIZE;
    return Math.min(size, 512);
}

export function avatarFileFor(size: number): string {
    return (AVATAR_FILES.find(([width]) => width >= size) ?? AVATAR_FILES.at(-1)!)[1];
}
