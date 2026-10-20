import {
    createMessage,
    readKey,
    readKeys,
    readSignature,
    verify,
    type Key,
    type Signature
} from 'openpgp';
import type { OpenPgpUserId } from '@idstead/domain/openpgpKey.ts';
import { CV_SIGNATURE_LIMIT } from '#lib/server/cvChecksums.ts';

export const OPENPGP_KEY_LIMIT = 64 * 1024;

export class OpenPgpError extends Error {}

export interface ParsedPublicKey {
    key: Key;
    fingerprint: string;
    userIds: OpenPgpUserId[];
    algorithm: string;
    createdAt: string;
    expiresAt: string | null;
    armored: string;
}

const textDecoder = new TextDecoder();

function armorText(bytes: Uint8Array) {
    const head = textDecoder.decode(bytes.subarray(0, 64)).trimStart();
    return head.startsWith('-----BEGIN PGP ') ? textDecoder.decode(bytes) : null;
}

function algorithmLabel(key: Key) {
    const info = key.getAlgorithmInfo() as { algorithm: string; bits?: number; curve?: string };
    if (/^eddsa|ed25519/i.test(info.algorithm)) return 'Ed25519';
    if (/ed448/i.test(info.algorithm)) return 'Ed448';
    if (/^rsa/i.test(info.algorithm)) return `RSA ${info.bits ?? ''}`.trim();
    if (info.curve) return `${info.algorithm.toUpperCase()} ${info.curve}`;
    return info.algorithm;
}

async function validUserIds(key: Key) {
    const ids: OpenPgpUserId[] = [];
    for (const user of key.users) {
        if (!user.userID) continue;
        try {
            await user.verify();
        } catch {
            continue;
        }
        const name = user.userID.name.trim();
        const email = user.userID.email.trim().toLowerCase();
        if (name || email) ids.push({ name, email });
    }
    return ids;
}

export async function parsePublicKey(bytes: Uint8Array): Promise<ParsedPublicKey> {
    if (bytes.byteLength === 0 || bytes.byteLength > OPENPGP_KEY_LIMIT)
        throw new OpenPgpError('Public keys must be between 1 byte and 64 KiB.');
    const armored = armorText(bytes);
    if (armored?.includes('PRIVATE KEY BLOCK'))
        throw new OpenPgpError('This is a private key. Export the public key with gpg --export.');
    let key: Key;
    try {
        key =
            armored ? await readKey({ armoredKey: armored }) : await readKey({ binaryKey: bytes });
    } catch {
        throw new OpenPgpError('This file is not an OpenPGP public key.');
    }
    if (key.isPrivate())
        throw new OpenPgpError('This is a private key. Export the public key with gpg --export.');
    if (await key.isRevoked()) throw new OpenPgpError('This key has been revoked.');
    try {
        await key.verifyPrimaryKey();
    } catch {
        throw new OpenPgpError('This key is expired or has no valid self-signature.');
    }
    try {
        await key.getSigningKey();
    } catch {
        throw new OpenPgpError('This key has no valid signing key.');
    }
    const userIds = await validUserIds(key);
    if (userIds.length === 0) throw new OpenPgpError('This key has no valid user ID.');
    const expires = await key.getExpirationTime();
    return {
        key,
        fingerprint: key.getFingerprint().toUpperCase(),
        userIds,
        algorithm: algorithmLabel(key),
        createdAt: key.getCreationTime().toISOString(),
        expiresAt: expires instanceof Date ? expires.toISOString() : null,
        armored: key.toPublic().armor()
    };
}

const DETACHED_HINT =
    'Upload a detached signature made with gpg --detach-sign (with or without --armor).';

export async function parseDetachedSignature(bytes: Uint8Array) {
    if (bytes.byteLength === 0 || bytes.byteLength > CV_SIGNATURE_LIMIT)
        throw new OpenPgpError('Signature files are at most 16 KiB.');
    const armored = armorText(bytes);
    if (armored !== null && !armored.trimStart().startsWith('-----BEGIN PGP SIGNATURE-----'))
        throw new OpenPgpError(DETACHED_HINT);
    let signature: Signature;
    try {
        signature =
            armored ?
                await readSignature({ armoredSignature: armored })
            :   await readSignature({ binarySignature: bytes });
    } catch {
        throw new OpenPgpError(DETACHED_HINT);
    }
    if (signature.packets.length !== 1) throw new OpenPgpError('Upload exactly one signature.');
    return { signature, asc: signature.armor(), sig: signature.write() as Uint8Array };
}

export async function verifyDetachedSignature(data: Uint8Array, signature: Signature, key: Key) {
    const issuers = signature.getSigningKeyIDs();
    const keyIds = key.getKeyIDs();
    if (!issuers.some(issuer => keyIds.some(id => id.equals(issuer))))
        throw new OpenPgpError(
            `This signature was made with key ${issuers.map(id => id.toHex().toUpperCase()).join(', ')}, not your active key ${key.getFingerprint().toUpperCase()}.`
        );
    const { signatures } = await verify({
        message: await createMessage({ binary: data }),
        signature,
        verificationKeys: key,
        format: 'binary'
    });
    const [result] = signatures;
    try {
        if (!result) throw new Error('No signature to verify.');
        await result.verified;
    } catch {
        throw new OpenPgpError(
            'This signature does not match the current PDF. Sign the exact file named above.'
        );
    }
}

const KEYSERVER_RESPONSE_LIMIT = 512 * 1024;

export async function readLimited(stream: ReadableStream<Uint8Array> | null, limit: number) {
    if (!stream) return new Uint8Array();
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
            await reader.cancel();
            throw new RangeError('Body exceeds the size limit.');
        }
        chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}

export async function verifyKeyserver(
    url: string,
    fingerprint: string,
    fetchFn: typeof fetch = fetch
) {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new OpenPgpError(`${url} is not a valid URL.`);
    }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password)
        throw new OpenPgpError(
            `${parsed.host}: keyserver links must use https without credentials.`
        );
    let response: Response;
    try {
        response = await fetchFn(parsed, {
            headers: { Accept: 'application/pgp-keys, text/plain' },
            redirect: 'follow',
            signal: AbortSignal.timeout(8000)
        });
    } catch {
        throw new OpenPgpError(`${parsed.host} did not respond.`);
    }
    if (!response.ok)
        throw new OpenPgpError(`${parsed.host} does not have this key (HTTP ${response.status}).`);
    if (response.url && new URL(response.url).protocol !== 'https:')
        throw new OpenPgpError(`${parsed.host} redirected away from https.`);
    let bytes: Uint8Array;
    try {
        bytes = await readLimited(response.body, KEYSERVER_RESPONSE_LIMIT);
    } catch {
        throw new OpenPgpError(`${parsed.host} returned more data than a public key.`);
    }
    let keys: Key[];
    try {
        const armored = armorText(bytes);
        keys =
            armored ?
                await readKeys({ armoredKeys: armored })
            :   await readKeys({ binaryKeys: bytes });
    } catch {
        keys = [];
    }
    if (!keys.some(key => key.getFingerprint().toUpperCase() === fingerprint))
        throw new OpenPgpError(`${parsed.host} does not serve key ${fingerprint}.`);
}
