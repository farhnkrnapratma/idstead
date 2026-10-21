import { LEGACY_STORAGE_KEYS } from './legacyStorageKeys';

export function readStorage(key: string, storage: Storage = localStorage): string | null {
    const value = storage.getItem(key);
    if (value !== null) return value;
    const legacy = LEGACY_STORAGE_KEYS[key];
    if (!legacy) return null;
    const previous = storage.getItem(legacy);
    if (previous === null) return null;
    storage.setItem(key, previous);
    storage.removeItem(legacy);
    return previous;
}
