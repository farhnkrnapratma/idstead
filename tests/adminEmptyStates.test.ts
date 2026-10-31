// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    hasChartActivity,
    helpfulPercent,
    majorityPercent,
    shouldShowDataControls
} from '../packages/lib/src/adminWorkspace';

describe('admin empty-state values', () => {
    test('shows zero feedback scores as percentages', () => {
        expect(helpfulPercent(0, 0)).toBe('0%');
        expect(majorityPercent(0, 0)).toBe('0%');
    });

    test('preserves calculated feedback percentages when responses exist', () => {
        expect(helpfulPercent(3, 1)).toBe('75%');
        expect(majorityPercent(3, 1)).toBe('75% helpful');
        expect(majorityPercent(1, 3)).toBe('75% unhelpful');
    });

    test('detects chart data only when at least one value is positive', () => {
        expect(hasChartActivity([])).toBe(false);
        expect(hasChartActivity([0, 0])).toBe(false);
        expect(hasChartActivity([0, 2, 0])).toBe(true);
    });

    test('keeps data controls for populated or actively filtered collections', () => {
        expect(shouldShowDataControls(2, false)).toBe(true);
        expect(shouldShowDataControls(0, true)).toBe(true);
        expect(shouldShowDataControls(0, false)).toBe(false);
    });
});
