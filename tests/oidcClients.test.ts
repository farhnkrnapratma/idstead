import { describe, expect, test } from 'bun:test';
import {
    generateClientId,
    generateClientSecret,
    parseClientInput,
    redirectUriError,
    sha256Hex
} from '../packages/lib/src/server/oidc/clients.ts';

describe('OIDC client input', () => {
    test('accepts https and loopback http redirect URIs only', () => {
        expect(redirectUriError('https://app.example/callback?x=1')).toBeNull();
        expect(redirectUriError('http://localhost:3000/cb')).toBeNull();
        expect(redirectUriError('http://127.0.0.1:8080/cb')).toBeNull();
        expect(redirectUriError('http://[::1]:8080/cb')).toBeNull();
        expect(redirectUriError('http://app.example/cb')).toContain('https');
        expect(redirectUriError('https://app.example/cb#frag')).toContain('fragment');
        expect(redirectUriError('https://user:pass@app.example/cb')).toContain('credentials');
        expect(redirectUriError('https://*.app.example/cb')).toContain('wildcards');
        expect(redirectUriError('/relative')).toContain('absolute');
        expect(redirectUriError('javascript:alert(1)')).not.toBeNull();
        expect(redirectUriError(`https://app.example/${'a'.repeat(2000)}`)).toContain('long');
    });

    test('trims, deduplicates and bounds the redirect list and the name', () => {
        expect(
            parseClientInput(' Notes ', [
                ' https://notes.example/cb ',
                'https://notes.example/cb',
                ''
            ])
        ).toEqual({ ok: true, name: 'Notes', redirectUris: ['https://notes.example/cb'] });
        expect(parseClientInput('', ['https://a.example/cb']).ok).toBe(false);
        expect(parseClientInput('x'.repeat(81), ['https://a.example/cb']).ok).toBe(false);
        expect(parseClientInput('Notes', []).ok).toBe(false);
        expect(parseClientInput('Notes', 'https://a.example/cb').ok).toBe(false);
        expect(
            parseClientInput(
                'Notes',
                Array.from({ length: 11 }, (_, i) => `https://a.example/${i}`)
            ).ok
        ).toBe(false);
        const rejected = parseClientInput('Notes', ['http://evil.example/cb']);
        expect(rejected).toEqual({
            ok: false,
            message: 'The redirect URI http://evil.example/cb must use https, or http on localhost.'
        });
    });

    test('generates URL-safe identifiers and hashes secrets as hex', async () => {
        const id = generateClientId();
        const secret = generateClientSecret();
        expect(id).toMatch(/^[A-Za-z0-9_-]{24}$/);
        expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(generateClientSecret()).not.toBe(secret);
        expect(await sha256Hex('abc')).toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
        );
    });
});
