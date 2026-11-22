// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import { keyserverFor } from '../packages/domain/src/openpgpKey.ts';

const FP = '1429FF4253AF1A5A5DA8CF603ACA1C5351084637';

test('keyserverFor maps known hosts to their lookup URL', () => {
    expect(keyserverFor('keys.openpgp.org', FP)).toEqual({
        label: 'keys.openpgp.org',
        url: `https://keys.openpgp.org/vks/v1/by-fingerprint/${FP}`
    });
});

test('keyserverFor builds an HKPS lookup for any other host', () => {
    expect(keyserverFor(' Pgp.Example.org/ ', FP)).toEqual({
        label: 'pgp.example.org',
        url: `https://pgp.example.org/pks/lookup?op=get&options=mr&search=0x${FP}`
    });
});

test('keyserverFor keeps a full https URL as written', () => {
    expect(keyserverFor('https://example.com/key.asc', FP)).toEqual({
        label: 'example.com',
        url: 'https://example.com/key.asc'
    });
});

test('keyserverFor rejects other schemes, credentials and junk', () => {
    expect(keyserverFor('http://example.com/key.asc', FP)).toBeNull();
    expect(keyserverFor('https://user:pw@example.com/', FP)).toBeNull();
    expect(keyserverFor('not a host', FP)).toBeNull();
    expect(keyserverFor('localhost', FP)).toBeNull();
});
