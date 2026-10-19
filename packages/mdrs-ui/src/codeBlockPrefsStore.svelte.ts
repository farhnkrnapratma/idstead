import { browser } from '$app/env';
import { SvelteSet } from 'svelte/reactivity';
import type { CodeColorScheme } from './codeBlocks.ts';

interface CodeBlockPrefs {
    colorScheme: CodeColorScheme;
    lineNumbers: boolean;
    wrap: boolean;
    minimal: boolean;
}

const STORAGE_KEY = 'codeblock_prefs';

const defaults: CodeBlockPrefs = {
    colorScheme: 'auto',
    lineNumbers: true,
    wrap: false,
    minimal: false
};

function readStoredPrefs(): string | null {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

function createCodeBlockPrefsStore() {
    let prefs = $state<CodeBlockPrefs>({ ...defaults });
    const listeners = new SvelteSet<() => void>();

    function notify() {
        for (const listener of listeners) {
            listener();
        }
    }

    function persist() {
        if (!browser) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
        } catch (err) {
            void err;
        }
    }

    function apply(next: Partial<CodeBlockPrefs>) {
        prefs = { ...prefs, ...next };
        persist();
        notify();
    }

    function parseStored(raw: string | null): Partial<CodeBlockPrefs> {
        if (!raw) return {};
        try {
            const parsed = JSON.parse(raw);
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        } catch {
            return {};
        }
    }

    function setColorScheme(scheme: CodeColorScheme) {
        apply({ colorScheme: scheme });
    }

    function setWrap(enabled: boolean) {
        apply({ wrap: enabled });
    }

    function setLineNumbers(enabled: boolean) {
        apply({ lineNumbers: enabled });
    }

    function setMinimal(enabled: boolean) {
        apply({ minimal: enabled });
    }

    function cycleColorScheme() {
        const order: CodeColorScheme[] = ['auto', 'light', 'dark'];
        const next = order[(order.indexOf(prefs.colorScheme) + 1) % order.length];
        apply({ colorScheme: next });
    }

    function toggleLineNumbers() {
        apply({ lineNumbers: !prefs.lineNumbers });
    }

    function toggleWrap() {
        apply({ wrap: !prefs.wrap });
    }

    function toggleMinimal() {
        apply({ minimal: !prefs.minimal });
    }

    function subscribe(fn: () => void) {
        listeners.add(fn);
        return () => {
            listeners.delete(fn);
        };
    }

    function init(onChange?: () => void) {
        if (!browser) return;
        if (onChange) {
            listeners.add(onChange);
        }

        const stored = parseStored(readStoredPrefs());
        prefs = { ...defaults, ...stored };

        const onStorage = (e: StorageEvent) => {
            if (e.key !== STORAGE_KEY) return;
            prefs = { ...defaults, ...parseStored(e.newValue) };
            notify();
        };

        window.addEventListener('storage', onStorage);

        return () => {
            window.removeEventListener('storage', onStorage);
            if (onChange) {
                listeners.delete(onChange);
            }
        };
    }

    return {
        get current() {
            return prefs;
        },
        init,
        subscribe,
        apply,
        setColorScheme,
        setWrap,
        setLineNumbers,
        setMinimal,
        cycleColorScheme,
        toggleLineNumbers,
        toggleWrap,
        toggleMinimal
    };
}

export const codeBlockPrefsStore = createCodeBlockPrefsStore();
