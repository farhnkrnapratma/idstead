// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    calendarThresholds,
    calendarWeekColumns,
    integerTicks
} from '../packages/lib/src/adminWorkspace.ts';

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

test('integerTicks keeps chart ticks on whole numbers', () => {
    expect(integerTicks(1)).toEqual([0, 1]);
    expect(integerTicks(8)).toEqual([0, 2, 4, 6, 8]);
    expect(integerTicks(10)).toEqual([0, 3, 6, 9]);
});

test('calendarThresholds spreads colours over the active days', () => {
    expect(calendarThresholds([0, 0, 0])).toEqual([1, 2, 3, 4]);
    expect(calendarThresholds([1, 2, 3, 4, 5, 6, 7, 8, 1000])).toEqual([1, 4, 6, 8]);
});
