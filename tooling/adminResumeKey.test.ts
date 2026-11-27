// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import {
    chooseFile,
    click,
    confirmDialog,
    failure,
    menu,
    openAdmin,
    route,
    sent,
    settle,
    text,
    toast,
    type
} from './support/adminHarness.ts';
import { snapshot } from './fixtures/admin.ts';

const fingerprint = 'ABCDEF0123456789ABCDEF0123456789ABCDEF01';
const soon = new Date(Date.now() + 5 * 86_400_000).toISOString();

const key = {
    fingerprint,
    userIds: [{ name: 'Ada Lovelace', email: 'ada@example.com' }],
    algorithm: 'Ed25519',
    createdAt: '2026-01-01T00:00:00.000Z',
    expiresAt: soon,
    keyservers: [
        {
            label: 'keys.openpgp.org',
            url: `https://keys.openpgp.org/vks/v1/by-fingerprint/${fingerprint}`
        }
    ],
    armored: '-----BEGIN PGP PUBLIC KEY BLOCK-----'
};

const signedDocument = {
    ...snapshot.resumeDocument,
    filename: 'resume-v1.2.pdf',
    version: undefined,
    signerFingerprint: fingerprint,
    checksums: { sha256: 'a', sha512: 'b', b2: 'c', md5: 'd' }
};

function withAuthor(extra: object) {
    route('GET author', () => ({ ...snapshot, ...extra }));
}

function fileInput(selector: string) {
    const input = document.querySelector<HTMLInputElement>(selector);
    if (!input) throw new Error(`No file input ${selector}`);
    return input;
}

function hiddenInput(accept: string) {
    const input = [
        ...document.querySelectorAll<HTMLInputElement>('input[type="file"].hidden')
    ].find(element => element.accept.startsWith(accept));
    if (!input) throw new Error(`No hidden file input for ${accept}`);
    return input;
}

function keyserverField() {
    const field = document.querySelector<HTMLInputElement>('#openpgp-keyserver');
    if (!field) throw new Error('No keyserver field');
    return field;
}

test('a signed resume shows its signer, checksums and the expiring key', async () => {
    withAuthor({ resumeDocument: signedDocument, openPgpKey: key });
    await openAdmin('?tab=resume');
    expect(text()).toContain('v1.2');
    expect(text()).toContain('Signed by Ada Lovelace');
    expect(text()).toContain('Checksums');
    expect(text()).toContain('Expires');
    expect(text()).toContain('1/8');
});

test('downloading the PDF saves it, and a failed download opens it instead', async () => {
    withAuthor({ resumeDocument: signedDocument, openPgpKey: key });
    const opened: unknown[] = [];
    window.open = ((...args: unknown[]) => opened.push(args)) as unknown as typeof window.open;
    await openAdmin('?tab=resume');

    route('GET /resume.pdf', () => new Response(new Blob(['%PDF']), { status: 200 }));
    await click('Download PDF');
    expect(opened).toHaveLength(0);

    route('GET /resume.pdf', () => new Response('missing', { status: 404 }));
    await click('Download PDF');
    expect(toast().message).toBe('Could not download directly, opening in a new tab');
    expect(opened).toHaveLength(1);
});

test('the signature can be replaced and deleted, and errors stay on the card', async () => {
    withAuthor({ resumeDocument: signedDocument, openPgpKey: key });
    await openAdmin('?tab=resume');

    await chooseFile(hiddenInput('.asc,.sig'), new File([new Uint8Array(17 * 1024)], 'big.sig'));
    expect(text()).toContain('Signature files are at most 16 KiB.');

    route('POST resume/signature', () => failure('Signature does not match the PDF.'));
    await chooseFile(hiddenInput('.asc,.sig'), new File(['sig'], 'resume.sig'));
    expect(text()).toContain('Signature does not match the PDF.');

    route('POST resume/signature', () => ({
        success: true,
        signedAt: '2026-05-02T10:00:00.000Z',
        signerFingerprint: fingerprint
    }));
    await chooseFile(hiddenInput('.asc,.sig'), new File(['sig'], 'resume.sig'));
    expect(toast().message).toBe('Signature verified and published.');

    route('DELETE resume/signature', () => failure('Storage is unavailable.', 503));
    await menu('More resume actions', 'Delete signature');
    await confirmDialog(/Delete/);
    expect(text()).toContain('Storage is unavailable.');

    route('DELETE resume/signature', () => ({ success: true }));
    await menu('More resume actions', 'Delete signature');
    await confirmDialog(/Delete/);
    expect(toast().message).toBe('Resume signature deleted.');
    expect(text()).toContain('Sign this PDF');
});

test('an unsigned resume takes a signature through the upload field', async () => {
    withAuthor({
        resumeDocument: { ...signedDocument, signedAt: null, signerFingerprint: null },
        openPgpKey: key
    });
    await openAdmin('?tab=resume');
    expect(text()).toContain('Unsigned');
    route('POST resume/signature', () => ({
        success: true,
        signedAt: '2026-05-02T10:00:00.000Z',
        signerFingerprint: fingerprint
    }));
    await chooseFile(fileInput('#resume-signature-file'), new File(['sig'], 'resume.sig'));
    expect(sent('POST', 'resume/signature')).toHaveLength(1);
    expect(text()).toContain('Signed by Ada Lovelace');
});

test('keyservers are validated, added, suggested and removed', async () => {
    withAuthor({ resumeDocument: signedDocument, openPgpKey: key });
    await openAdmin('?tab=resume');
    const saved = (keyservers: unknown[]) => ({ success: true, key: { ...key, keyservers } });

    await type(keyserverField(), 'not a host');
    await click('Add');
    expect(text()).toContain('Enter a keyserver host such as keys.openpgp.org');

    await type(keyserverField(), 'keys.openpgp.org');
    await click('Add');
    expect(text()).toContain('keys.openpgp.org is already listed.');

    route('POST openpgp-key', () => failure('That keyserver does not have this key.'));
    await type(keyserverField(), 'keys.example.org');
    keyserverField().dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    );
    await settle();
    expect(text()).toContain('That keyserver does not have this key.');

    route('POST openpgp-key', (_url, init) =>
        saved(JSON.parse(String(init.body)).keyservers as unknown[])
    );
    await click(/keyserver\.ubuntu\.com/);
    expect(toast().message).toBe('keyserver.ubuntu.com added.');
    expect(text()).toContain('2/8');

    await click('Remove keys.openpgp.org');
    expect(toast().message).toBe('keys.openpgp.org removed.');
    expect(text()).toContain('1/8');
});

test('a key with eight keyservers takes no more', async () => {
    const full = Array.from({ length: 8 }, (_, index) => ({
        label: `keys${index}.example.org`,
        url: `https://keys${index}.example.org/pks/lookup?op=get&search=0x${fingerprint}`
    }));
    withAuthor({ resumeDocument: signedDocument, openPgpKey: { ...key, keyservers: full } });
    await openAdmin('?tab=resume');
    expect(text()).toContain('8/8');
    expect(document.querySelector('#openpgp-keyserver')).toBeNull();
});

test('uploading a key checks its size, publishes it and clears an old signature', async () => {
    withAuthor({ resumeDocument: signedDocument, openPgpKey: null });
    await openAdmin('?tab=resume');
    expect(text()).toContain('Add your OpenPGP key below to sign this PDF.');

    await chooseFile(
        fileInput('#openpgp-key-file'),
        new File([new Uint8Array(65 * 1024)], 'big.asc')
    );
    expect(text()).toContain('Public keys must be at most 64 KiB.');

    route('POST openpgp-key', () => failure('This is not an OpenPGP public key.'));
    await chooseFile(
        fileInput('#openpgp-key-file'),
        new File([new Uint8Array([153, 1, 2])], 'key.gpg')
    );
    expect(text()).toContain('This is not an OpenPGP public key.');
    const binary = sent('POST', 'openpgp-key').at(-1)?.body as { key: { base64?: string } };
    expect(binary.key.base64).toBe(btoa(String.fromCharCode(153, 1, 2)));

    route('POST openpgp-key', () => ({
        success: true,
        key: { ...key, armored: undefined },
        signatureCleared: true
    }));
    await chooseFile(fileInput('#openpgp-key-file'), new File([key.armored], 'key.asc'));
    expect(toast().message).toBe('Key saved. Sign the resume again with the new key.');
    expect(text()).toContain('Sign this PDF');
});

test('replacing a key reports errors in a toast, and a new key publishes', async () => {
    withAuthor({ resumeDocument: signedDocument, openPgpKey: key });
    await openAdmin('?tab=resume');

    route('POST openpgp-key', () => failure('The key has expired.'));
    await chooseFile(hiddenInput('.asc,.gpg'), new File([key.armored], 'key.asc'));
    expect(toast()).toEqual({ message: 'The key has expired.', type: 'error' });

    route('POST openpgp-key', () => ({ success: true, key }));
    await chooseFile(hiddenInput('.asc,.gpg'), new File([key.armored], 'key.asc'));
    expect(toast().message).toBe('OpenPGP key published.');
});

test('deleting the key reports failures and clears the signature on success', async () => {
    withAuthor({ resumeDocument: signedDocument, openPgpKey: key });
    await openAdmin('?tab=resume');

    route('DELETE openpgp-key', () => failure('Could not reach storage.', 503));
    await menu('More key actions', 'Delete key');
    await confirmDialog(/Delete/);
    expect(toast()).toEqual({ message: 'Could not reach storage.', type: 'error' });

    route('DELETE openpgp-key', () => ({ success: true }));
    await menu('More key actions', 'Delete key');
    await confirmDialog(/Delete/);
    expect(toast().message).toBe('OpenPGP key deleted.');
    expect(text()).toContain('Upload your public key');
});

test('the resume can be regenerated, reports up-to-date and failures, and be deleted', async () => {
    withAuthor({ resumeDocument: signedDocument, openPgpKey: key });
    await openAdmin('?tab=resume');

    route('POST resume/generate', () => ({ success: true, upToDate: true, version: '1.2' }));
    await menu('More resume actions', 'Regenerate');
    expect(toast().message).toBe('The resume is already up to date (v1.2).');

    route('POST resume/generate', () => failure('Profile is incomplete.'));
    await menu('More resume actions', 'Regenerate');
    expect(text()).toContain('Profile is incomplete.');

    route('POST resume/generate', () => ({
        success: true,
        filename: 'resume-v1.3.pdf',
        fileUrl: '/resume-v1.3.pdf',
        hash: 'h',
        version: '1.3',
        reasons: ['profile changed']
    }));
    await menu('More resume actions', 'Regenerate');
    expect(toast().message).toBe('Resume PDF generated (v1.3: profile changed)');
    expect(text()).toContain('Generated resume-v1.3.pdf');

    route('POST resume/delete', () => failure('Delete is not allowed.', 403));
    await menu('More resume actions', 'Delete resume');
    await confirmDialog(/Delete/);
    expect(toast()).toEqual({ message: 'Delete is not allowed.', type: 'error' });

    route('POST resume/delete', () => ({ success: true }));
    await menu('More resume actions', 'Delete resume');
    await confirmDialog(/Delete/);
    expect(toast().message).toBe('Resume deleted.');
    expect(text()).toContain('No resume generated yet');
});
