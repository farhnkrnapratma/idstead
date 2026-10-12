import { describe, expect, test } from 'bun:test';
import { getSafeRedirectUrl } from '../packages/lib/src/utils/safeRedirect.ts';

describe('admin login redirect target', () => {
    test('keeps admin pages on the admin host', () => {
        expect(getSafeRedirectUrl('/?tab=posts&editPost=new')).toBe('/?tab=posts&editPost=new');
        expect(getSafeRedirectUrl('/new?id=1')).toBe('/new?id=1');
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
});
