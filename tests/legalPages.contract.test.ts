import { describe, expect, test } from 'bun:test';
import {
    createSupabaseLegalPageRepository,
    createSupabaseLegalPageWriter
} from '../packages/data/src/supabase/legal.ts';
import { fakeSupabase, type Row } from './support/fakeSupabase.ts';

function legalDb(rpc: NonNullable<Parameters<typeof fakeSupabase>[2]>['rpc'] = {}) {
    return fakeSupabase(
        {
            db_legals: [
                {
                    slug: 'terms',
                    title: 'Terms',
                    content: '# Terms',
                    updated_at: '2026-10-01T00:00:00Z'
                },
                { slug: 'privacy', title: null, content: null }
            ]
        },
        {},
        { rpc }
    ).db;
}

describe('Supabase legal page adapter', () => {
    test('reads one page and every page', async () => {
        const legal = createSupabaseLegalPageRepository(legalDb());
        expect(await legal.page('terms')).toEqual({
            slug: 'terms',
            title: 'Terms',
            content: '# Terms',
            updated_at: '2026-10-01T00:00:00Z'
        });
        expect(await legal.page('privacy')).toEqual({ slug: 'privacy', title: '', content: '' });
        expect(await legal.page('security')).toBeNull();
        expect((await legal.pages()).map(page => page.slug)).toEqual(['privacy', 'terms']);
    });

    test('saves through the database function and reports a rejection', async () => {
        const calls: Row[] = [];
        let fail = false;
        const writer = createSupabaseLegalPageWriter(
            legalDb({
                db_save_legal: args => {
                    calls.push(args);
                    return fail ?
                            { data: null, error: { message: 'not allowed' } }
                        :   { data: null, error: null };
                }
            })
        );
        const page = { slug: 'terms' as const, title: 'Terms', content: '# New' };
        expect(await writer.save(page)).toEqual({ status: 'saved' });
        expect(calls).toEqual([{ p_slug: 'terms', p_title: 'Terms', p_content: '# New' }]);
        fail = true;
        expect(await writer.save(page)).toEqual({ status: 'rejected', message: 'not allowed' });
    });
});
