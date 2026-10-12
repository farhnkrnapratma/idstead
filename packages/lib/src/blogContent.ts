export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

export function contentKey(hash: string, ext: string) {
    if (!SHA256_HEX_PATTERN.test(hash)) throw new Error('Invalid content hash.');
    return `blog/content/${hash}.${ext}`;
}
