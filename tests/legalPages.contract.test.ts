// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    createD1LegalPageRepository,
    createD1LegalPageWriter
} from '../packages/data/src/d1/legal.ts';
import { d1Shim, insertRows } from './support/d1.ts';

describe('D1 legal page adapter', () => {
    function d1Legal() {
        const { db, sqlite } = d1Shim();
        insertRows(sqlite, 'db_legals', [
            {
                slug: 'terms',
                title: 'Terms',
                content: '# Terms',
                updated_at: '2026-10-01T00:00:00Z'
            },
            { slug: 'privacy', title: '', content: '' }
        ]);
        return { db, sqlite };
    }

    test('reads one page and every page', async () => {
        const legal = createD1LegalPageRepository(d1Legal().db);
        expect(await legal.page('terms')).toEqual({
            slug: 'terms',
            title: 'Terms',
            content: '# Terms',
            updated_at: '2026-10-01T00:00:00Z'
        });
        expect(await legal.page('security')).toBeNull();
        expect((await legal.pages()).map(page => page.slug)).toEqual(['privacy', 'terms']);
    });

    test('inserts a missing page and updates an existing one', async () => {
        const { db } = d1Legal();
        const writer = createD1LegalPageWriter(db);
        const legal = createD1LegalPageRepository(db);
        expect(await writer.save({ slug: 'security', title: 'Security', content: '# S' })).toEqual({
            status: 'saved'
        });
        await writer.save({ slug: 'terms', title: 'Terms of use', content: '# New' });
        expect(await legal.page('terms')).toMatchObject({
            title: 'Terms of use',
            content: '# New'
        });
        expect((await legal.page('security'))?.updated_at).toMatch(/Z$/);
    });
});
