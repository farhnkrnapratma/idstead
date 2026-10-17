import { describe, expect, test } from 'bun:test';
import { getSafeRedirectUrl } from '../packages/lib/src/utils/safeRedirect.ts';

describe('admin login redirect target', () => {
    test('keeps admin pages on the admin host', () => {
        expect(getSafeRedirectUrl('/?tab=posts&editPost=new')).toBe('/?tab=posts&editPost=new');
        expect(getSafeRedirectUrl('/new?id=1')).toBe('/new?id=1');
        expect(getSafeRedirectUrl('/%2F/evil.example')).toBe('/%2F/evil.example');
    });

    test('falls back to the dashboard for missing or unsafe targets', () => {
        expect(getSafeRedirectUrl(null)).toBe('/');
        expect(getSafeRedirectUrl('https://evil.example/')).toBe('/');
        expect(getSafeRedirectUrl('//evil.example/')).toBe('/');
        expect(getSafeRedirectUrl('/\\evil.example')).toBe('/');
        expect(getSafeRedirectUrl('/login?redirectTo=/login')).toBe('/');
        expect(getSafeRedirectUrl('/api/internal/admin/logout')).toBe('/');
        expect(getSafeRedirectUrl('javascript:alert(1)')).toBe('/');
    });

    test('falls back when the browser would strip control characters into a foreign host', () => {
        expect(getSafeRedirectUrl('/\t/evil.example')).toBe('/');
        expect(getSafeRedirectUrl('/\n/evil.example')).toBe('/');
        expect(getSafeRedirectUrl('/\r\n/evil.example')).toBe('/');
        expect(getSafeRedirectUrl('/\\/evil.example')).toBe('/');
        expect(getSafeRedirectUrl(' //evil.example')).toBe('/');
    });

    test('falls back when dot-segment normalization leaves a protocol-relative path', () => {
        expect(getSafeRedirectUrl('/.//evil.example')).toBe('/');
        expect(getSafeRedirectUrl('/..//evil.example')).toBe('/');
        expect(getSafeRedirectUrl('/x/..//evil.example')).toBe('/');
        expect(getSafeRedirectUrl('/%2e//evil.example')).toBe('/');
        expect(getSafeRedirectUrl('/%2e%2e//evil.example')).toBe('/');
        expect(getSafeRedirectUrl('/./\\evil.example')).toBe('/');
        expect(getSafeRedirectUrl('/./\t/evil.example')).toBe('/');
        expect(getSafeRedirectUrl('/x/../login')).toBe('/');
    });
});
