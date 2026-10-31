// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import {
    activeFilterCount,
    sortMenuGroups,
    type FilterMenuGroup
} from '../packages/ui/src/components/filter/filterMenu.ts';

function group(overrides: Partial<FilterMenuGroup>): FilterMenuGroup {
    return {
        label: 'Group',
        mode: 'single',
        options: [],
        selected: [],
        onSelect: () => {},
        ...overrides
    };
}

describe('activeFilterCount', () => {
    test('counts every selected value of a multi-select group', () => {
        expect(activeFilterCount([group({ mode: 'multi', selected: ['a', 'b'] })])).toBe(2);
    });

    test('counts a single-select group only when it leaves its default', () => {
        expect(activeFilterCount([group({ selected: ['all'], defaultValue: 'all' })])).toBe(0);
        expect(activeFilterCount([group({ selected: ['read'], defaultValue: 'all' })])).toBe(1);
    });

    test('never counts a group without a default, such as sorting', () => {
        expect(activeFilterCount([group({ selected: ['title'] })])).toBe(0);
    });
});

describe('sortMenuGroups', () => {
    test('builds the sort field and order groups from the current sort', () => {
        const [field, order] = sortMenuGroups({
            fields: [{ value: 'date', label: 'Date' }],
            field: 'date',
            direction: 'desc',
            onFieldChange: () => {},
            onDirectionToggle: () => {}
        });
        expect(field).toMatchObject({ label: 'Sort by', mode: 'single', selected: ['date'] });
        expect(order).toMatchObject({ label: 'Order', mode: 'single', selected: ['desc'] });
    });

    test('toggles the direction only when another order is chosen', () => {
        let toggles = 0;
        const [, order] = sortMenuGroups({
            fields: [],
            field: 'date',
            direction: 'desc',
            onFieldChange: () => {},
            onDirectionToggle: () => toggles++
        });
        order.onSelect('desc');
        expect(toggles).toBe(0);
        order.onSelect('asc');
        expect(toggles).toBe(1);
    });
});
