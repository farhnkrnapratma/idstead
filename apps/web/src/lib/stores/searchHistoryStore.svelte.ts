import { browser } from '$app/env';
import { readStorage } from '@idstead/ui/utils/storageKeys.ts';

export interface SearchHistoryEntry {
    id: string;
    category:
        | 'pages'
        | 'posts'
        | 'projects'
        | 'actions'
        | 'commands'
        | 'skills'
        | 'social'
        | 'contact'
        | 'funding';
    title: string;
    subtitle?: string;
    badge?: string;
    iconName?: string;
}

const STORAGE_KEY = 'idstead_search_history';
const MAX_ENTRIES = 5;

function createSearchHistoryStore() {
    let current = $state<SearchHistoryEntry[]>([]);

    if (browser) {
        try {
            const stored = JSON.parse(readStorage(STORAGE_KEY) || '[]');
            if (Array.isArray(stored)) {
                current = stored
                    .filter(
                        (entry): entry is SearchHistoryEntry =>
                            entry
                            && typeof entry === 'object'
                            && typeof entry.id === 'string'
                            && typeof entry.title === 'string'
                            && entry.id !== 'cmd-history'
                            && entry.id !== 'dyn-history-clear'
                    )
                    .slice(0, MAX_ENTRIES);
            }
        } catch {}
    }

    function persist() {
        if (!browser) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
        } catch {}
    }

    function record(entry: SearchHistoryEntry) {
        if (!entry.id || !entry.title.trim()) return;
        current = [entry, ...current.filter(existing => existing.id !== entry.id)].slice(
            0,
            MAX_ENTRIES
        );
        persist();
    }

    return {
        get current() {
            return current;
        },
        record
    };
}

export const searchHistoryStore = createSearchHistoryStore();
