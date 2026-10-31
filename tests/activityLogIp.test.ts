import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { clientAddress } from '../packages/lib/src/server/activityLog.ts';

describe('clientAddress', () => {
    test('returns the address the adapter reports', () => {
        expect(clientAddress(() => '203.0.113.7')).toBe('203.0.113.7');
    });

    test('returns null when the address is missing or the getter throws', () => {
        expect(clientAddress(undefined)).toBeNull();
        expect(clientAddress(() => '')).toBeNull();
        expect(clientAddress(() => null as unknown as string)).toBeNull();
        expect(
            clientAddress(() => {
                throw new Error('no address');
            })
        ).toBeNull();
    });
});

describe('admin activity log calls', () => {
    const routes = [
        ...new Bun.Glob('apps/admin/src/routes/api/internal/**/+server.ts').scanSync('.')
    ].map(file => ({ file, source: readFileSync(file, 'utf8') }));
    const helper = readFileSync('packages/lib/src/server/adminRequest.ts', 'utf8');

    test('admin routes log through logAdminActivity', () => {
        expect(
            routes.filter(route => route.source.includes('logAdminActivity(')).length
        ).toBeGreaterThan(10);
        expect(
            routes.filter(route => /\blogActivity\(/.test(route.source)).map(route => route.file)
        ).toEqual([]);
    });

    test.each(['ip', 'ipSalt', 'userAgent'])('logAdminActivity passes %s', field => {
        expect(helper).toMatch(new RegExp(`\\b${field}:`));
    });
});
