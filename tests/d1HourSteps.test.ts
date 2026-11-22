// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import { hourSteps, localHourStart } from '../packages/data/src/d1/time.ts';

test('steps through local hours in order and aligns to the hour', () => {
    const start = Date.UTC(2026, 0, 2, 10, 30, 15, 250);
    const aligned = localHourStart(start, 'UTC');
    expect(aligned).toBe(Date.UTC(2026, 0, 2, 10, 0, 0, 0));
    const steps = hourSteps(start, start + 3 * 3_600_000, 'UTC');
    expect(steps.length).toBe(4);
    expect(steps[1] - steps[0]).toBe(3_600_000);
});
