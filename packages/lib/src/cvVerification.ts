import { apiUrl } from '#lib/apiConfig.ts';
import {
    formatFingerprint,
    formatUserId,
    wkdEmails,
    type OpenPgpKeyserver,
    type OpenPgpUserId
} from '#lib/openpgpKey.ts';

export const CV_CHECKSUM_ALGORITHMS = [
    { ext: 'sha256', label: 'SHA-256', command: 'sha256sum' },
    { ext: 'sha512', label: 'SHA-512', command: 'sha512sum' },
    { ext: 'b2', label: 'BLAKE2b', command: 'b2sum' },
    { ext: 'md5', label: 'MD5', command: 'md5sum' }
] as const;

export type CvChecksumExt = (typeof CV_CHECKSUM_ALGORITHMS)[number]['ext'];
export type CvSignatureExt = 'asc' | 'sig';
export type CvChecksums = Record<CvChecksumExt, string>;

export interface CvSigningKey {
    fingerprint: string;
    userIds: OpenPgpUserId[];
    keyservers: OpenPgpKeyserver[];
}

export interface CvVerificationInput {
    filename: string;
    signed: boolean;
    key: CvSigningKey | null;
    siteUrl: string;
    apiBase?: string | null;
}

export function cvBundleFilename(filename: string) {
    return `${filename.replace(/\.pdf$/i, '')}-verify.zip`;
}

export function cvFileUrl(
    output: 'pdf' | CvChecksumExt | CvSignatureExt | 'zip',
    apiBase?: string | null
) {
    return apiUrl(`/cv?output=${output}`, apiBase);
}

export function publicKeyUrl(siteUrl: string) {
    return `${siteUrl.replace(/\/+$/, '')}/pgp.asc`;
}

export function cvKeySources(key: CvSigningKey, siteUrl: string) {
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

export function cvVerifyText(input: CvVerificationInput) {
    const { filename, signed, key, siteUrl, apiBase } = input;
    const lines = [
        `Verifying ${filename}`,
        '',
        'Run these commands in the folder you extracted this archive into.',
        `The PDF is also available on its own at ${cvFileUrl('pdf', apiBase)}`,
        '',
        '1. Checksums',
        '',
        ...CV_CHECKSUM_ALGORITHMS.map(({ ext, command }) => `  ${command} -c ${filename}.${ext}`),
        '',
        '2. Signature',
        ''
    ];
    if (!signed || !key) {
        lines.push('  This version of the CV is not signed yet.');
        return `${lines.join('\n')}\n`;
    }
    const sources = cvKeySources(key, siteUrl);
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

export interface CvDocumentSource {
    filename: string;
    version?: string | null;
    updatedAt?: string;
    checksums?: CvChecksums | null;
    signedAt?: string | null;
    signerFingerprint?: string | null;
}

export function cvDocumentInfo(
    document: CvDocumentSource,
    key: CvSigningKey | null,
    siteUrl: string,
    apiBase?: string | null
) {
    const signer = document.signedAt && key && document.signerFingerprint === key.fingerprint;
    const sources = key ? cvKeySources(key, siteUrl) : null;
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
            pdf: cvFileUrl('pdf', apiBase),
            ...(Object.fromEntries(
                CV_CHECKSUM_ALGORITHMS.map(({ ext }) => [ext, cvFileUrl(ext, apiBase)])
            ) as Record<CvChecksumExt, string>),
            ...(signer ? { asc: cvFileUrl('asc', apiBase), sig: cvFileUrl('sig', apiBase) } : {}),
            zip: cvFileUrl('zip', apiBase)
        } as Record<'pdf' | 'zip' | CvChecksumExt, string>
            & Partial<Record<CvSignatureExt, string>>,
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

export type CvDocumentInfo = ReturnType<typeof cvDocumentInfo>;

export function cvDocumentMarkdown(info: CvDocumentInfo) {
    const lines = ['## CV Document', '', `- **File**: ${info.filename}`];
    if (info.version) lines.push(`- **Version**: v${info.version}`);
    lines.push(`- **PDF**: ${info.files.pdf}`, `- **Verification bundle**: ${info.files.zip}`);
    if (info.checksums) {
        lines.push('', '### Checksums', '');
        for (const { ext, label } of CV_CHECKSUM_ALGORITHMS)
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
