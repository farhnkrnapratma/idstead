// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import { analyticsPeriod } from '../apps/admin/src/lib/adminAnalytics.ts';

const now = new Date('2026-06-15T12:00:00Z');

test('builds a custom range up to today and rejects invalid or overlong ones', () => {
    const closed = analyticsPeriod('custom', 'UTC', now, '2026-06-01', '2026-06-10');
    expect(closed.from).toBe(new Date('2026-06-01T00:00:00Z').toISOString());
    expect(closed.to).toBe(new Date('2026-06-11T00:00:00Z').toISOString());

    const toToday = analyticsPeriod('custom', 'UTC', now, '2026-06-01', '2026-06-15');
    expect(toToday.to).toBe(now.toISOString());

    expect(() => analyticsPeriod('custom', 'UTC', now, '2026-06-10', '2026-06-01')).toThrow(
        'Choose valid start and end dates'
    );
    expect(() => analyticsPeriod('custom', 'UTC', now, '2026-06-01', '2026-06-16')).toThrow(
        'Choose valid start and end dates'
    );
    expect(() => analyticsPeriod('custom', 'UTC', now, '2024-01-01', '2026-06-10')).toThrow(
        'Choose a period of up to one year.'
    );
});
