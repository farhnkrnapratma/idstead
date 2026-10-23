import { describe, expect, test } from 'bun:test';
import { siteOrigin } from '../packages/domain/src/siteOrigin.ts';

describe('siteOrigin', () => {
    test('keeps only the origin of an http or https URL', () => {
        expect(siteOrigin('https://example.com/path?q=1')).toBe('https://example.com');
        expect(siteOrigin(' http://localhost:5173/ ')).toBe('http://localhost:5173');
    });

    test('rejects empty, malformed, credentialed and non-web URLs', () => {
        for (const value of [
            null,
            undefined,
            '',
            '   ',
            'not a url',
            'ftp://example.com',
            'javascript:alert(1)',
            'https://user:pass@example.com'
        ])
            expect(siteOrigin(value)).toBeNull();
    });
});
