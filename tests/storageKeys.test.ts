import { describe, expect, test } from 'bun:test';
import { readStorage } from '../packages/ui/src/utils/storageKeys.ts';
import { LEGACY_STORAGE_KEYS } from '../packages/ui/src/utils/legacyStorageKeys.ts';

function memoryStorage(entries: Record<string, string> = {}): Storage {
    const map = new Map(Object.entries(entries));
    return {
        get length() {
            return map.size;
        },
        clear: () => map.clear(),
        getItem: key => map.get(key) ?? null,
        key: index => [...map.keys()][index] ?? null,
        removeItem: key => void map.delete(key),
        setItem: (key, value) => void map.set(key, String(value))
    };
}

describe('readStorage', () => {
    const [key, legacy] = Object.entries(LEGACY_STORAGE_KEYS)[0];

    test('returns the current key when it is set', () => {
        const storage = memoryStorage({ [key]: 'new', [legacy]: 'old' });
        expect(readStorage(key, storage)).toBe('new');
        expect(storage.getItem(legacy)).toBe('old');
    });

    test('moves a legacy value to the new key once', () => {
        const storage = memoryStorage({ [legacy]: 'old' });
        expect(readStorage(key, storage)).toBe('old');
        expect(storage.getItem(key)).toBe('old');
        expect(storage.getItem(legacy)).toBeNull();
        expect(readStorage(key, storage)).toBe('old');
    });

    test('returns null when neither key exists or the key has no legacy name', () => {
        expect(readStorage(key, memoryStorage())).toBeNull();
        expect(readStorage('idstead_unknown', memoryStorage({ legacy_unknown: 'x' }))).toBeNull();
    });

    test('every new key uses the idstead prefix', () => {
        for (const name of Object.keys(LEGACY_STORAGE_KEYS))
            expect(name.startsWith('idstead_')).toBe(true);
    });
});
