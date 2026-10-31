// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export interface FilterMenuOption {
    value: string;
    label: string;
}

export interface FilterMenuGroup {
    label: string;
    mode: 'single' | 'multi';
    options: FilterMenuOption[];
    selected: string[];
    onSelect: (value: string) => void;
    defaultValue?: string;
    searchable?: boolean;
    searchPlaceholder?: string;
}

export function activeFilterCount(groups: readonly FilterMenuGroup[]): number {
    return groups.reduce((count, group) => {
        if (group.mode === 'multi') return count + group.selected.length;
        if (group.defaultValue === undefined) return count;
        return count + (group.selected.some(value => value !== group.defaultValue) ? 1 : 0);
    }, 0);
}

export function sortMenuGroups(options: {
    fields: FilterMenuOption[];
    field: string;
    direction: 'asc' | 'desc';
    onFieldChange: (field: string) => void;
    onDirectionToggle: () => void;
}): FilterMenuGroup[] {
    return [
        {
            label: 'Sort by',
            mode: 'single',
            options: options.fields,
            selected: [options.field],
            onSelect: options.onFieldChange
        },
        {
            label: 'Order',
            mode: 'single',
            options: [
                { value: 'asc', label: 'Ascending' },
                { value: 'desc', label: 'Descending' }
            ],
            selected: [options.direction],
            onSelect: value => {
                if (value !== options.direction) options.onDirectionToggle();
            }
        }
    ];
}
