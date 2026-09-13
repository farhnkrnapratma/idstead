import {browser} from '$app/environment';

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

const STORAGE_KEY = 'fkp_search_history';
const MAX_ENTRIES = 8;

function createSearchHistoryStore() {
  let current = $state<SearchHistoryEntry[]>([]);

  if (browser) {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(stored)) {
        current = stored.filter(
          (entry): entry is SearchHistoryEntry =>
            entry
            && typeof entry === 'object'
            && typeof entry.id === 'string'
            && typeof entry.title === 'string'
        );
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
    current = [
      entry,
      ...current.filter(existing => existing.id !== entry.id)
    ].slice(0, MAX_ENTRIES);
    persist();
  }

  function syncEntry(id: string, updates: Partial<SearchHistoryEntry>) {
    let changed = false;
    current = current.map(item => {
      if (item.id === id) {
        let hasDiff = false;
        for (const [k, v] of Object.entries(updates) as [
          keyof SearchHistoryEntry,
          unknown
        ][]) {
          if (item[k] !== v) {
            hasDiff = true;
            break;
          }
        }
        if (hasDiff) {
          changed = true;
          return {...item, ...updates};
        }
      }
      return item;
    });
    if (changed) {
      persist();
    }
  }

  function remove(id: string) {
    current = current.filter(entry => entry.id !== id);
    persist();
  }

  function clear() {
    current = [];
    persist();
  }

  return {
    get current() {
      return current;
    },
    record,
    syncEntry,
    remove,
    clear
  };
}

export const searchHistoryStore = createSearchHistoryStore();
