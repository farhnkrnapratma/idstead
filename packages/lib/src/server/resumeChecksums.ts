// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { blake2b } from '@noble/hashes/blake2.js';
import { md5 } from '@noble/hashes/legacy.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { resumeBundleFilename } from '#lib/resumeVerification.ts';

export const RESUME_CHECKSUM_EXTENSIONS = ['sha256', 'sha512', 'md5', 'b2'] as const;
export const RESUME_SIGNATURE_EXTENSIONS = ['asc', 'sig'] as const;
export const RESUME_SIDECAR_EXTENSIONS = [
    ...RESUME_CHECKSUM_EXTENSIONS,
    ...RESUME_SIGNATURE_EXTENSIONS
] as const;

export type ResumeChecksumExtension = (typeof RESUME_CHECKSUM_EXTENSIONS)[number];

async function subtle(algorithm: 'SHA-256' | 'SHA-512', bytes: Uint8Array) {
    return bytesToHex(new Uint8Array(await crypto.subtle.digest(algorithm, new Uint8Array(bytes))));
}

export async function resumeChecksums(bytes: Uint8Array, filename: string) {
    const digests: Record<ResumeChecksumExtension, string> = {
        sha256: await subtle('SHA-256', bytes),
        sha512: await subtle('SHA-512', bytes),
        md5: bytesToHex(md5(bytes)),
        b2: bytesToHex(blake2b(bytes))
    };
    return {
        digests,
        files: Object.fromEntries(
            RESUME_CHECKSUM_EXTENSIONS.map(ext => [ext, `${digests[ext]}  ${filename}\n`])
        ) as Record<ResumeChecksumExtension, string>
    };
}

export function resumeKey(filename: string, ext?: string) {
    if (!/^[A-Za-z0-9._-]+\.pdf$/.test(filename)) throw new Error('Invalid resume filename.');
    return `resume/${filename}${ext ? `.${ext}` : ''}`;
}

export function resumeBundleKey(filename: string) {
    resumeKey(filename);
    return `resume/${resumeBundleFilename(filename)}`;
}

export const RESUME_SIGNATURE_LIMIT = 16 * 1024;
