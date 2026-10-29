import { strToU8, zipSync, type Zippable } from 'fflate';
import {
    resumeVerifyText,
    type ResumeChecksumExt,
    type ResumeVerificationInput
} from '#lib/resumeVerification.ts';

export interface ResumeBundleInput extends Omit<ResumeVerificationInput, 'signed'> {
    pdf: Uint8Array;
    checksumFiles: Record<ResumeChecksumExt, string>;
    signature: { asc: string; sig: Uint8Array } | null;
    publicKey: string | null;
    date: Date;
}

export function buildResumeBundle(input: ResumeBundleInput) {
    const { filename, pdf, checksumFiles, signature, publicKey, date } = input;
    const files: Zippable = {};
    const mtime = new Date(Math.max(date.getTime() || 0, Date.UTC(1980, 0, 2)));
    const add = (name: string, data: Uint8Array) => {
        files[name] = [data, { mtime }];
    };
    add(filename, pdf);
    for (const [ext, content] of Object.entries(checksumFiles))
        add(`${filename}.${ext}`, strToU8(content));
    if (signature) {
        add(`${filename}.asc`, strToU8(signature.asc));
        add(`${filename}.sig`, signature.sig);
    }
    if (publicKey) add('publickey.asc', strToU8(publicKey));
    add('VERIFY.txt', strToU8(resumeVerifyText({ ...input, signed: Boolean(signature) })));
    return zipSync(files, { level: 9 });
}
