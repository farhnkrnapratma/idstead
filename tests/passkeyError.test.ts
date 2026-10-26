import { describe, expect, test } from 'bun:test';
import { passkeyErrorMessage } from '../apps/admin/src/lib/passkeyError.ts';

function namedError(name: string, message: string) {
    const error = new Error(message);
    error.name = name;
    return error;
}

describe('passkeyErrorMessage', () => {
    test('shortens a canceled or timed-out passkey prompt', () => {
        const browserMessage =
            'The operation either timed out or was not allowed. See: https://www.w3.org/TR/webauthn-2/#sctn-privacy-considerations-client.';
        expect(passkeyErrorMessage(namedError('NotAllowedError', browserMessage), 'Failed.')).toBe(
            'Passkey request canceled or timed out.'
        );
        expect(passkeyErrorMessage(namedError('AbortError', 'aborted'), 'Failed.')).toBe(
            'Passkey request canceled or timed out.'
        );
    });

    test('keeps other error messages', () => {
        expect(passkeyErrorMessage(new Error('Invalid credentials.'), 'Failed.')).toBe(
            'Invalid credentials.'
        );
    });

    test('falls back when the error has no message', () => {
        expect(passkeyErrorMessage(new Error(''), 'Failed.')).toBe('Failed.');
        expect(passkeyErrorMessage('oops', 'Failed.')).toBe('Failed.');
    });
});
