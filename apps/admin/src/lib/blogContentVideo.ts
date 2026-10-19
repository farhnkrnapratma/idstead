export const CONTENT_VIDEO_LIMIT = 50_000_000;

export function isWebm(bytes: Uint8Array) {
    if (bytes.length < 8 || bytes[0] !== 0x1a || bytes[1] !== 0x45 || bytes[2] !== 0xdf)
        return false;
    if (bytes[3] !== 0xa3) return false;
    const header = String.fromCharCode(...bytes.subarray(0, Math.min(bytes.length, 64)));
    return header.includes('webm');
}
