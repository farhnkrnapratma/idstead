import { apiUrl } from '#lib/apiConfig.ts';
import {
    formatFingerprint,
    formatUserId,
    wkdEmails,
    type OpenPgpKeyserver,
    type OpenPgpUserId
} from '@idstead/domain/openpgpKey.ts';

import {
    RESUME_CHECKSUM_ALGORITHMS,
    type ResumeChecksumExt,
    type ResumeChecksums
} from '@idstead/domain/resumeChecksums.ts';

export { RESUME_CHECKSUM_ALGORITHMS, type ResumeChecksumExt, type ResumeChecksums };
export type ResumeSignatureExt = 'asc' | 'sig';

export interface ResumeSigningKey {
    fingerprint: string;
    userIds: OpenPgpUserId[];
    keyservers: OpenPgpKeyserver[];
}

export interface ResumeVerificationInput {
    filename: string;
    signed: boolean;
    key: ResumeSigningKey | null;
    siteUrl: string;
    apiBase?: string | null;
}

export function resumeBundleFilename(filename: string) {
    return `${filename.replace(/\.pdf$/i, '')}-verify.zip`;
}

export function resumeFileUrl(
    output: 'pdf' | ResumeChecksumExt | ResumeSignatureExt | 'zip',
    apiBase?: string | null
) {
    return apiUrl(`/resume?output=${output}`, apiBase);
}

export function publicKeyUrl(siteUrl: string) {
    return `${siteUrl.replace(/\/+$/, '')}/pgp.asc`;
}

export function resumeKeySources(key: ResumeSigningKey, siteUrl: string) {
    const host = (() => {
        try {
            return new URL(siteUrl).host;
        } catch {
            return '';
        }
    })();
    return {
        wkd: host ? wkdEmails(key.userIds, host) : [],
        url: siteUrl ? publicKeyUrl(siteUrl) : '',
        keyservers: key.keyservers
    };
}

export function resumeVerifyText(input: ResumeVerificationInput) {
    const { filename, signed, key, siteUrl, apiBase } = input;
    const lines = [
        `Verifying ${filename}`,
        '',
        'Run these commands in the folder you extracted this archive into.',
        `The PDF is also available on its own at ${resumeFileUrl('pdf', apiBase)}`,
        '',
        '1. Checksums',
        '',
        ...RESUME_CHECKSUM_ALGORITHMS.map(
            ({ ext, command }) => `  ${command} -c ${filename}.${ext}`
        ),
        '',
        '2. Signature',
        ''
    ];
    if (!signed || !key) {
        lines.push('  This version of the resume is not signed yet.');
        return `${lines.join('\n')}\n`;
    }
    const sources = resumeKeySources(key, siteUrl);
    lines.push(
        ...key.userIds.map(user => `  Signed by:   ${formatUserId(user)}`),
        `  Fingerprint: ${formatFingerprint(key.fingerprint)}`,
        '',
        '  Import the public key from a source other than this archive:',
        '',
        ...sources.wkd.map(email => `  gpg --auto-key-locate clear,wkd --locate-keys ${email}`),
        ...(sources.url ? [`  curl -sSf ${sources.url} | gpg --import`] : []),
        ...sources.keyservers.map(server => `  curl -sSf '${server.url}' | gpg --import`),
        '',
        '  publickey.asc in this archive is only a convenience copy. Before trusting it,',
        '  check that its fingerprint matches the one published on the website.',
        '',
        `  gpg --verify ${filename}.sig ${filename}`,
        `  gpg --verify ${filename}.asc ${filename}`
    );
    return `${lines.join('\n')}\n`;
}

export interface ResumeDocumentSource {
    filename: string;
    version?: string | null;
    updatedAt?: string;
    checksums?: ResumeChecksums | null;
    signedAt?: string | null;
    signerFingerprint?: string | null;
}

export function resumeDocumentInfo(
    document: ResumeDocumentSource,
    key: ResumeSigningKey | null,
    siteUrl: string,
    apiBase?: string | null
) {
    const signer = document.signedAt && key && document.signerFingerprint === key.fingerprint;
    const sources = key ? resumeKeySources(key, siteUrl) : null;
    return {
        filename: document.filename,
        version: document.version ?? null,
        updatedAt: document.updatedAt ?? null,
        checksums: document.checksums ?? null,
        signature:
            signer ?
                { signedAt: document.signedAt, fingerprint: key.fingerprint, signer: key.userIds }
            :   null,
        files: {
            pdf: resumeFileUrl('pdf', apiBase),
            ...(Object.fromEntries(
                RESUME_CHECKSUM_ALGORITHMS.map(({ ext }) => [ext, resumeFileUrl(ext, apiBase)])
            ) as Record<ResumeChecksumExt, string>),
            ...(signer ?
                { asc: resumeFileUrl('asc', apiBase), sig: resumeFileUrl('sig', apiBase) }
            :   {}),
            zip: resumeFileUrl('zip', apiBase)
        } as Record<'pdf' | 'zip' | ResumeChecksumExt, string>
            & Partial<Record<ResumeSignatureExt, string>>,
        publicKey:
            key && sources ?
                {
                    fingerprint: key.fingerprint,
                    url: sources.url || null,
                    wkd: sources.wkd,
                    keyservers: key.keyservers
                }
            :   null
    };
}

export type ResumeDocumentInfo = ReturnType<typeof resumeDocumentInfo>;

export function resumeDocumentMarkdown(info: ResumeDocumentInfo) {
    const lines = ['## Resume Document', '', `- **File**: ${info.filename}`];
    if (info.version) lines.push(`- **Version**: v${info.version}`);
    lines.push(`- **PDF**: ${info.files.pdf}`, `- **Verification bundle**: ${info.files.zip}`);
    if (info.checksums) {
        lines.push('', '### Checksums', '');
        for (const { ext, label } of RESUME_CHECKSUM_ALGORITHMS)
            lines.push(`- **${label}**: \`${info.checksums[ext]}\``);
    }
    lines.push('', '### Signature', '');
    if (!info.signature) lines.push('Not signed yet.');
    else {
        lines.push(
            ...info.signature.signer.map(user => `- **Signed by**: ${formatUserId(user)}`),
            `- **Fingerprint**: \`${formatFingerprint(info.signature.fingerprint)}\``,
            `- **Signature**: ${info.files.sig} (binary), ${info.files.asc} (armored)`
        );
    }
    if (info.publicKey) {
        if (info.publicKey.url) lines.push(`- **Public key**: ${info.publicKey.url}`);
        for (const email of info.publicKey.wkd)
            lines.push(`- **WKD**: \`gpg --locate-keys ${email}\``);
        for (const server of info.publicKey.keyservers)
            lines.push(`- **Keyserver (${server.label})**: ${server.url}`);
    }
    lines.push('');
    return lines.join('\n');
}
