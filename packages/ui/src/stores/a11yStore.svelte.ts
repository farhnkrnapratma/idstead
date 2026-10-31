// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { browser } from '$app/env';
import {
    A11Y_STORAGE_KEY,
    A11Y_SYSTEM_QUERIES,
    parseOverrides,
    resolveSettings,
    type A11ySettings,
    type A11yToggleKey,
    type FontScale
} from '../a11ySettings';

export type { FontScale };

function createA11yStore() {
    let overrides = $state<Partial<A11ySettings>>({});
    let system = $state<Partial<A11ySettings>>({});
    const settings = $derived(resolveSettings(system, overrides));

    function syncDom() {
        if (!browser) return;
        const root = document.documentElement;
        root.setAttribute('data-reduce-motion', String(settings.reduceMotion));
        root.setAttribute('data-high-contrast', String(settings.highContrast));
        root.setAttribute('data-font-scale', String(settings.fontScale));
        root.setAttribute('data-focus-highlight', String(settings.focusHighlight));
        root.setAttribute('data-dyslexic-font', String(settings.dyslexicFont));
    }

    function persist() {
        if (!browser) return;
        try {
            if (Object.keys(overrides).length === 0) localStorage.removeItem(A11Y_STORAGE_KEY);
            else localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(overrides));
        } catch {
            return;
        }
    }

    function apply(next: Partial<A11ySettings>) {
        overrides = { ...overrides, ...next };
        syncDom();
        persist();
    }

    function readOverrides(): Partial<A11ySettings> {
        try {
            const stored = localStorage.getItem(A11Y_STORAGE_KEY);
            return stored === null ? {} : parseOverrides(stored);
        } catch {
            return {};
        }
    }

    function init() {
        if (!browser) return;

        const queries = (Object.entries(A11Y_SYSTEM_QUERIES) as [A11yToggleKey, string][])
            .map(([key, query]) => [key, window.matchMedia(query)] as const)
            .filter(([, list]) => list.media !== 'not all');

        const readSystem = () => {
            system = Object.fromEntries(queries.map(([key, list]) => [key, list.matches]));
            syncDom();
        };

        overrides = readOverrides();
        readSystem();

        const onStorage = (e: StorageEvent) => {
            if (e.key !== A11Y_STORAGE_KEY) return;
            overrides = parseOverrides(e.newValue);
            syncDom();
        };

        queries.forEach(([, list]) => list.addEventListener('change', readSystem));
        window.addEventListener('storage', onStorage);

        if (typeof document !== 'undefined' && 'fonts' in document) {
            const preloadLexend = () => {
                document.fonts.load('400 1rem "Lexend Variable"').catch(() => {});
            };
            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(preloadLexend, { timeout: 2000 });
            } else {
                setTimeout(preloadLexend, 500);
            }
        }

        return () => {
            queries.forEach(([, list]) => list.removeEventListener('change', readSystem));
            window.removeEventListener('storage', onStorage);
        };
    }

    function enabledByDevice(key: A11yToggleKey) {
        return system[key] === true && !(key in overrides);
    }

    function toggleReduceMotion() {
        apply({ reduceMotion: !settings.reduceMotion });
    }

    function toggleHighContrast() {
        apply({ highContrast: !settings.highContrast });
    }

    function toggleFocusHighlight() {
        apply({ focusHighlight: !settings.focusHighlight });
    }

    function toggleDyslexicFont() {
        apply({ dyslexicFont: !settings.dyslexicFont });
    }

    function setFontScale(scale: FontScale) {
        apply({ fontScale: scale });
    }

    function reset() {
        overrides = {};
        syncDom();
        persist();
    }

    return {
        get current() {
            return settings;
        },
        enabledByDevice,
        init,
        toggleReduceMotion,
        toggleHighContrast,
        toggleFocusHighlight,
        toggleDyslexicFont,
        setFontScale,
        reset
    };
}

export const a11yStore = createA11yStore();

export const A11Y_TOGGLES: {
    key: 'reduceMotion' | 'highContrast' | 'focusHighlight' | 'dyslexicFont';
    label: string;
    description: string;
    toggle: () => void;
}[] = [
    {
        key: 'reduceMotion',
        label: 'Reduce motion',
        description: 'Stops animations, transitions and moving backgrounds.',
        toggle: a11yStore.toggleReduceMotion
    },
    {
        key: 'highContrast',
        label: 'High contrast text',
        description: 'Shows secondary and muted text in the main text color.',
        toggle: a11yStore.toggleHighContrast
    },
    {
        key: 'focusHighlight',
        label: 'Focus ring highlight',
        description: 'Draws a thick outline around the element the keyboard focuses.',
        toggle: a11yStore.toggleFocusHighlight
    },
    {
        key: 'dyslexicFont',
        label: 'Dyslexic-friendly font',
        description: 'Switches the site to Lexend, a font that is easier to read, except code.',
        toggle: a11yStore.toggleDyslexicFont
    }
];
