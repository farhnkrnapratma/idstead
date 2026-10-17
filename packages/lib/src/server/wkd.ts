import { dearmor, wkdEmails, wkdHash, type PublicOpenPgpKey } from '#lib/openpgpKey.ts';

export async function wkdKey(hash: string, key: PublicOpenPgpKey | null, siteUrl: string) {
    if (!key || !/^[ybndrfg8ejkmcpqxot1uwisza345h769]{32}$/.test(hash)) return null;
    const emails = wkdEmails(key.userIds, new URL(siteUrl).host);
    const hashes = await Promise.all(emails.map(email => wkdHash(email.split('@')[0])));
    return hashes.includes(hash) ? dearmor(key.armored) : null;
}
