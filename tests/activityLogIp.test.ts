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
    const files = new Bun.Glob('apps/admin/src/routes/api/internal/admin/**/+server.ts').scanSync(
        '.'
    );
    const calls = [...files].flatMap(file => {
        const source = readFileSync(file, 'utf8');
        return [
            ...source.matchAll(/logActivity\(\s*\{([\s\S]*?)\},\s*[\w.?()]*activityLog\b/g)
        ].map(match => ({ file, body: match[1] }));
    });

    test('finds the calls', () => {
        expect(calls.length).toBeGreaterThan(10);
    });

    test.each(['ip', 'ipSalt', 'userAgent'])('every call passes %s', field => {
        const missing = calls
            .filter(call => !new RegExp(`\\b${field}\\b`).test(call.body))
            .map(call => call.file);
        expect(missing).toEqual([]);
    });
});
