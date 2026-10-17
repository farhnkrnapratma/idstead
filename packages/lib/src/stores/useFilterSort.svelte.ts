import { replaceState } from '$app/navigation';
import { SvelteURL } from 'svelte/reactivity';

export interface SortState {
    field: string;
    direction: 'asc' | 'desc';
}

export interface ActiveFilterChip {
    id: string;
    type: string;
    value: string;
    label: string;
}

export interface FilterSortOptions {
    defaultSortField?: string;
    defaultSortDir?: 'asc' | 'desc';
}

export function createFilterSortStore(options: FilterSortOptions = {}) {
    const defaultSort: SortState = {
        field: options.defaultSortField || 'date',
        direction: options.defaultSortDir || 'desc'
    };

    let search = $state('');
    let filters = $state<Record<string, string[]>>({});
    let sort = $state<SortState>({ ...defaultSort });

    const isFiltered = $derived.by(() => {
        if (search.trim().length > 0) return true;
        if (sort.field !== defaultSort.field || sort.direction !== defaultSort.direction)
            return true;
        for (const key in filters) {
            if (filters[key] && filters[key].length > 0) return true;
        }
        return false;
    });

    const activeChips = $derived.by(() => {
        const list: ActiveFilterChip[] = [];
        for (const type in filters) {
            const values = filters[type] || [];
            for (const val of values) {
                if (!val || val === 'all') continue;
                list.push({ id: `${type}:${val}`, type, value: val, label: `${type}: ${val}` });
            }
        }
        return list;
    });

    function setSearch(q: string) {
        search = q;
        syncToUrl();
    }

    function setSingleFilter(type: string, value: string) {
        if (!value || value === 'all') {
            const next = { ...filters };
            delete next[type];
            filters = next;
        } else {
            filters = { ...filters, [type]: [value] };
        }
        syncToUrl();
    }

    function toggleMultiFilter(type: string, value: string) {
        const current = filters[type] || [];
        if (current.includes(value)) {
            const nextArr = current.filter(v => v !== value);
            if (nextArr.length === 0) {
                const next = { ...filters };
                delete next[type];
                filters = next;
            } else {
                filters = { ...filters, [type]: nextArr };
            }
        } else {
            filters = { ...filters, [type]: [...current, value] };
        }
        syncToUrl();
    }

    function removeFilter(type: string, value: string) {
        const current = filters[type] || [];
        const nextArr = current.filter(v => v !== value);
        if (nextArr.length === 0) {
            const next = { ...filters };
            delete next[type];
            filters = next;
        } else {
            filters = { ...filters, [type]: nextArr };
        }
        syncToUrl();
    }

    function clearAllFilters() {
        search = '';
        filters = {};
        sort = { ...defaultSort };
        syncToUrl();
    }

    function setSort(field: string, direction?: 'asc' | 'desc') {
        if (direction) {
            sort = { field, direction };
        } else {
            const nextDir = sort.field === field && sort.direction === 'desc' ? 'asc' : 'desc';
            sort = { field, direction: nextDir };
        }
        syncToUrl();
    }

    function toggleSortDirection() {
        sort = { field: sort.field, direction: sort.direction === 'asc' ? 'desc' : 'asc' };
        syncToUrl();
    }

    function syncToUrl() {
        if (typeof window === 'undefined') return;
        const url = new SvelteURL(window.location.href);

        if (search.trim()) {
            url.searchParams.set('q', search.trim());
        } else {
            url.searchParams.delete('q');
        }

        if (sort.field !== defaultSort.field) {
            url.searchParams.set('sort', sort.field);
        } else {
            url.searchParams.delete('sort');
        }

        if (sort.direction !== defaultSort.direction) {
            url.searchParams.set('dir', sort.direction);
        } else {
            url.searchParams.delete('dir');
        }

        for (const key of Array.from(url.searchParams.keys())) {
            if (key !== 'q' && key !== 'sort' && key !== 'dir' && key !== 'id') {
                url.searchParams.delete(key);
            }
        }

        for (const type in filters) {
            if (filters[type] && filters[type].length > 0) {
                url.searchParams.set(type, filters[type].join(','));
            }
        }

        replaceState(url.toString(), {});
    }

    function parseFromUrl(url: URL) {
        const q = url.searchParams.get('q') || '';
        const sortField = url.searchParams.get('sort') || defaultSort.field;
        const sortDir = (url.searchParams.get('dir') as 'asc' | 'desc') || defaultSort.direction;

        search = q;
        sort = { field: sortField, direction: sortDir };

        const newFilters: Record<string, string[]> = {};
        for (const [key, val] of url.searchParams.entries()) {
            if (key === 'q' || key === 'sort' || key === 'dir' || key === 'id') continue;
            if (
                key.startsWith('_')
                || key.startsWith('utm_')
                || key === 'gclid'
                || key === 'fbclid'
                || key === 'ref'
                || key === 'source'
                || key === 'via'
            )
                continue;
            if (val) {
                newFilters[key] = val.split(',').filter(Boolean);
            }
        }
        filters = newFilters;
    }

    return {
        get search() {
            return search;
        },
        set search(v: string) {
            search = v;
        },
        get filters() {
            return filters;
        },
        get sort() {
            return sort;
        },
        get isFiltered() {
            return isFiltered;
        },
        get activeChips() {
            return activeChips;
        },
        setSearch,
        setSingleFilter,
        toggleMultiFilter,
        removeFilter,
        clearAllFilters,
        setSort,
        toggleSortDirection,
        syncToUrl,
        parseFromUrl
    };
}
