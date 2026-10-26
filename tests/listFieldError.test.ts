import { describe, expect, test } from 'bun:test';
import { listFieldError } from '../apps/admin/src/lib/listFieldError.ts';

describe('listFieldError', () => {
    test('accepts an empty optional field', () => {
        expect(listFieldError('grade', 'Grade', '', true)).toBe('');
        expect(listFieldError('grade', 'Grade', '   ', true)).toBe('');
    });

    test('still requires fields that are not optional', () => {
        expect(listFieldError('institution', 'Institution', '', false)).toBe(
            'Institution is required.'
        );
    });

    test('checks link schemes on URL fields', () => {
        expect(listFieldError('url', 'URL', 'example.com', false)).toBe(
            'Must start with http://, https://, mailto:, or tel:'
        );
        expect(listFieldError('href', 'URL', 'mailto:me@example.com', false)).toBe('');
    });

    test('accepts a filled optional field', () => {
        expect(listFieldError('grade', 'Grade', '3.8', true)).toBe('');
    });
});
