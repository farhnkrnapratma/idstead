// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, mock, test } from 'bun:test';

const visited: string[] = [];
const actual = await import('$app/navigation');
mock.module('$app/navigation', () => ({
    ...actual,
    goto: async (url: string) => {
        visited.push(url);
    }
}));

const { createFilterSortStore } = await import('../packages/ui/src/stores/useFilterSort.svelte.ts');

beforeEach(() => {
    visited.length = 0;
    window.history.replaceState({}, '', 'https://dom.test/blog?keep=1&id=7');
});

describe('createFilterSortStore', () => {
    test('starts from the defaults and reports activity', () => {
        const store = createFilterSortStore({ defaultSortField: 'title', defaultSortDir: 'asc' });
        expect(store.sort).toEqual({ field: 'title', direction: 'asc' });
        expect(store.isFiltered).toBe(false);
        store.search = '  x ';
        expect(store.search).toBe('  x ');
        expect(store.isFiltered).toBe(true);
        store.clearAllFilters();
        expect(store.isFiltered).toBe(false);
        expect(createFilterSortStore().sort).toEqual({ field: 'date', direction: 'desc' });
    });

    test('keeps single, multi and removable filters in sync with the URL', () => {
        const store = createFilterSortStore();
        store.setSearch(' hello ');
        store.setSingleFilter('tag', 'svelte');
        store.setSingleFilter('tag', 'all');
        store.setSingleFilter('tag', 'bun');
        store.toggleMultiFilter('cat', 'a');
        store.toggleMultiFilter('cat', 'b');
        store.toggleMultiFilter('cat', 'a');
        expect(store.filters).toEqual({ tag: ['bun'], cat: ['b'] });
        store.toggleMultiFilter('cat', 'b');
        expect(store.filters).toEqual({ tag: ['bun'] });
        store.toggleMultiFilter('tag', 'x');
        store.removeFilter('tag', 'x');
        store.removeFilter('tag', 'bun');
        expect(store.filters).toEqual({});
        store.removeFilter('missing', 'v');
        expect(store.activeChips).toEqual([]);
        expect(visited.at(-1)).toContain('q=hello');
        expect(visited.at(-1)).toContain('id=7');
        expect(visited.at(-1)).not.toContain('keep=1');
    });

    test('lists chips, skipping empty and "all" values', () => {
        const store = createFilterSortStore();
        store.parseFromUrl(new URL('https://dom.test/?tag=a,all,b&empty='));
        expect(store.activeChips.map(chip => chip.id)).toEqual(['tag:a', 'tag:b']);
        expect(store.activeChips[0].label).toBe('tag: a');
    });

    test('sorts by field, toggles direction and encodes non-default sorts', () => {
        const store = createFilterSortStore();
        store.setSort('title');
        expect(store.sort).toEqual({ field: 'title', direction: 'desc' });
        store.setSort('title');
        expect(store.sort).toEqual({ field: 'title', direction: 'asc' });
        store.setSort('views', 'asc');
        expect(store.sort).toEqual({ field: 'views', direction: 'asc' });
        expect(visited.at(-1)).toContain('sort=views');
        expect(visited.at(-1)).toContain('dir=asc');
        store.toggleSortDirection();
        store.toggleSortDirection();
        expect(store.sort.direction).toBe('asc');
        store.setSort('date', 'desc');
        expect(visited.at(-1)).not.toContain('sort=');
        expect(visited.at(-1)).not.toContain('dir=');
    });

    test('parses search, sort and filters from a URL and ignores tracking parameters', () => {
        const store = createFilterSortStore();
        store.parseFromUrl(
            new URL(
                'https://dom.test/?q=hi&sort=title&dir=asc&tag=a,b&utm_x=1&_gl=2&ref=z&gclid=1&id=3&fbclid=4&source=5&via=6'
            )
        );
        expect(store.search).toBe('hi');
        expect(store.sort).toEqual({ field: 'title', direction: 'asc' });
        expect(store.filters).toEqual({ tag: ['a', 'b'] });
        store.parseFromUrl(new URL('https://dom.test/?dir=sideways'));
        expect(store.sort).toEqual({ field: 'date', direction: 'desc' });
        expect(store.filters).toEqual({});
    });
});
