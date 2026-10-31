// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { calendarWeekColumns } from '../packages/lib/src/adminWorkspace.ts';

describe('calendarWeekColumns', () => {
    test.each([
        [2022, 54],
        [2023, 53],
        [2024, 53],
        [2026, 53],
        [2028, 54]
    ])('matches the d3 week count for %i', (year, expected) => {
        expect(calendarWeekColumns(year)).toBe(expected);
    });
});
