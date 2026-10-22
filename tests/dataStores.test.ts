import { describe, expect, mock, test } from 'bun:test';

mock.module('$app/env/public', () => ({}));
mock.module('$app/env/private', () => ({}));

const { DataBackendError, dataStores } = await import('../packages/lib/src/server/data.ts');

describe('dataStores', () => {
    test('uses the Supabase backend by default and rejects an unknown one', () => {
        expect(() => dataStores({ env: {} })).not.toThrow();
        expect(() => dataStores({ env: { DATA_BACKEND: 'supabase' } })).not.toThrow();
        expect(() => dataStores({ env: { DATA_BACKEND: 'd2' } })).toThrow(DataBackendError);
    });

    test('has public but no service stores without the service role key', () => {
        const stores = dataStores({ env: { SUPABASE_SERVICE_ROLE_KEY: '' } });
        expect(stores.service).toBeNull();
        expect(stores.public.blog).toBeDefined();
    });

    test('has no session stores without a bearer token', () => {
        expect(dataStores({ env: {} }).session).toBeNull();
        expect(
            dataStores({ env: {} }, { request: new Request('https://example.com') }).session
        ).toBeNull();
    });

    test('builds service stores once per call', () => {
        const stores = dataStores({
            env: {
                PUBLIC_SUPABASE_URL: 'https://db.example.com',
                SUPABASE_SERVICE_ROLE_KEY: 'service-role'
            }
        });
        expect(stores.service).not.toBeNull();
        expect(stores.service).toBe(stores.service);
        expect(Object.keys(stores.service!)).toEqual(
            expect.arrayContaining(['blog', 'writers', 'adminPosts', 'activityLog', 'lockout'])
        );
    });
});
