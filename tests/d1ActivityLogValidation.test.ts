// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import { createD1ActivityLog } from '../packages/data/src/d1/activity.ts';
import { d1Shim } from './support/d1.ts';

const base = {
    category: null,
    query: null,
    direction: 'desc',
    sort: 'created_at',
    from: null,
    to: null,
    limit: 20,
    offset: 0
};

test('rejects log queries outside the supported filters and limits', async () => {
    const { db } = d1Shim();
    const log = createD1ActivityLog(db);
    const rejected = [
        { ...base, direction: 'sideways' },
        { ...base, sort: 'secret' },
        { ...base, category: 'nope' },
        { ...base, from: 'not a date' },
        { ...base, from: '2026-02-01T00:00:00Z', to: '2026-01-01T00:00:00Z' },
        { ...base, query: 'x'.repeat(251) },
        { ...base, limit: 0 },
        { ...base, limit: 5001 },
        { ...base, offset: -1 }
    ];
    for (const filter of rejected) {
        await expect(log.list(filter as never)).rejects.toBeDefined();
    }
});

test('lists entries with a valid filter and sort', async () => {
    const { db } = d1Shim();
    const log = createD1ActivityLog(db);
    const page = await log.list({
        ...base,
        category: 'blog',
        query: '  Post  ',
        from: '2026-01-01T00:00:00Z',
        to: '2026-12-31T00:00:00Z',
        sort: 'action',
        direction: 'asc'
    } as never);
    expect(page.data).toEqual([]);
    expect(page.total).toBe(0);
});
