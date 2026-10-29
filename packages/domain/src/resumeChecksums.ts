export const RESUME_CHECKSUM_ALGORITHMS = [
    { ext: 'sha256', label: 'SHA-256', command: 'sha256sum' },
    { ext: 'sha512', label: 'SHA-512', command: 'sha512sum' },
    { ext: 'b2', label: 'BLAKE2b', command: 'b2sum' },
    { ext: 'md5', label: 'MD5', command: 'md5sum' }
] as const;

export type ResumeChecksumExt = (typeof RESUME_CHECKSUM_ALGORITHMS)[number]['ext'];
export type ResumeChecksums = Record<ResumeChecksumExt, string>;
