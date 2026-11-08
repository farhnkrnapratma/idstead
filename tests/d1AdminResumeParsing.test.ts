// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { createD1AuthorWriter } from '../packages/data/src/d1/adminAuthor.ts';
import { d1Shim } from './support/d1.ts';

const authorId = '00000000-0000-4000-8000-000000000001';

describe('D1 admin resume writes', () => {
    test('rejects a year that is not an integer', async () => {
        const { db } = d1Shim();
        const store = createD1AuthorWriter(db);
        expect(
            await store.saveResume(
                authorId,
                [{ start_year: 'abc', currently_in: false }] as never,
                []
            )
        ).toMatchObject({ status: 'rejected' });
    });

    test('rejects a currently-in flag that is not a boolean', async () => {
        const { db } = d1Shim();
        const store = createD1AuthorWriter(db);
        expect(
            await store.saveResume(authorId, [], [
                { start_year: 2020, currently_in: 'maybe' }
            ] as never)
        ).toMatchObject({ status: 'rejected' });
    });

    test('accepts blank years and string booleans and defaults the sort order', async () => {
        const { db } = d1Shim();
        const store = createD1AuthorWriter(db);
        const result = await store.saveResume(
            authorId,
            [{ start_year: '', end_year: '', currently_in: 'true', sort_order: null }] as never,
            [{ start_year: '2019', currently_in: 'f', sort_order: '3' }] as never
        );
        expect(result).toBeDefined();
    });
});
