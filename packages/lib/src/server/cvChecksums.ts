import { blake2b } from '@noble/hashes/blake2.js';
import { md5 } from '@noble/hashes/legacy.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { cvBundleFilename } from '#lib/cvVerification.ts';

export const CV_CHECKSUM_EXTENSIONS = ['sha256', 'sha512', 'md5', 'b2'] as const;
export const CV_SIGNATURE_EXTENSIONS = ['asc', 'sig'] as const;
export const CV_SIDECAR_EXTENSIONS = [
    ...CV_CHECKSUM_EXTENSIONS,
    ...CV_SIGNATURE_EXTENSIONS
] as const;

export type CvChecksumExtension = (typeof CV_CHECKSUM_EXTENSIONS)[number];

async function subtle(algorithm: 'SHA-256' | 'SHA-512', bytes: Uint8Array) {
    return bytesToHex(new Uint8Array(await crypto.subtle.digest(algorithm, new Uint8Array(bytes))));
}

export async function cvChecksums(bytes: Uint8Array, filename: string) {
    const digests: Record<CvChecksumExtension, string> = {
        sha256: await subtle('SHA-256', bytes),
        sha512: await subtle('SHA-512', bytes),
        md5: bytesToHex(md5(bytes)),
        b2: bytesToHex(blake2b(bytes))
    };
    return {
        digests,
        files: Object.fromEntries(
            CV_CHECKSUM_EXTENSIONS.map(ext => [ext, `${digests[ext]}  ${filename}\n`])
        ) as Record<CvChecksumExtension, string>
    };
}

export function cvKey(filename: string, ext?: string) {
    if (!/^[A-Za-z0-9._-]+\.pdf$/.test(filename)) throw new Error('Invalid CV filename.');
    return `cv/${filename}${ext ? `.${ext}` : ''}`;
}

export function cvBundleKey(filename: string) {
    cvKey(filename);
    return `cv/${cvBundleFilename(filename)}`;
}

export const CV_SIGNATURE_LIMIT = 16 * 1024;
