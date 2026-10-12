import { browser } from '$app/env';

export type FontScale = 100 | 110 | 120 | 130 | 140 | 150;

interface A11ySettings {
    reduceMotion: boolean;
    solidSurfaces: boolean;
    highContrast: boolean;
    fontScale: FontScale;
    focusHighlight: boolean;
    dyslexicFont: boolean;
}

const STORAGE_KEY = 'a11y_settings';

const defaults: A11ySettings = {
    reduceMotion: false,
    solidSurfaces: false,
    highContrast: false,
    fontScale: 100,
    focusHighlight: false,
    dyslexicFont: false
};

function createA11yStore() {
    let settings = $state<A11ySettings>({ ...defaults });

    function syncDom() {
        if (!browser) return;
        const root = document.documentElement;
        root.setAttribute('data-reduce-motion', String(settings.reduceMotion));
        root.setAttribute('data-solid-surfaces', String(settings.solidSurfaces));
        root.setAttribute('data-high-contrast', String(settings.highContrast));
        root.setAttribute('data-font-scale', String(settings.fontScale));
        root.setAttribute('data-focus-highlight', String(settings.focusHighlight));
        root.setAttribute('data-dyslexic-font', String(settings.dyslexicFont));
    }

    function persist() {
        if (!browser) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }

    function apply(next: Partial<A11ySettings>) {
        settings = { ...settings, ...next };
        syncDom();
        persist();
    }

    function parseStored(raw: string | null): Partial<A11ySettings> {
        if (!raw) return {};
        try {
            const parsed = JSON.parse(raw);
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        } catch {
            return {};
        }
    }

    function init() {
        if (!browser) return;

        const stored = parseStored(localStorage.getItem(STORAGE_KEY));
        const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const hasStoredMotionPref = Object.hasOwn(stored, 'reduceMotion');

        settings = {
            ...defaults,
            ...stored,
            reduceMotion:
                hasStoredMotionPref ? Boolean(stored.reduceMotion) : reduceMotionQuery.matches
        };
        syncDom();

        const onMotionChange = (e: MediaQueryListEvent) => {
            if (!Object.hasOwn(parseStored(localStorage.getItem(STORAGE_KEY)), 'reduceMotion')) {
                apply({ reduceMotion: e.matches });
            }
        };

        const onStorage = (e: StorageEvent) => {
            if (e.key !== STORAGE_KEY) return;
            settings = { ...defaults, ...parseStored(e.newValue) };
            syncDom();
        };

        reduceMotionQuery.addEventListener('change', onMotionChange);
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
            reduceMotionQuery.removeEventListener('change', onMotionChange);
            window.removeEventListener('storage', onStorage);
        };
    }

    function toggleReduceMotion() {
        apply({ reduceMotion: !settings.reduceMotion });
    }

    function toggleSolidSurfaces() {
        apply({ solidSurfaces: !settings.solidSurfaces });
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
        apply({ ...defaults });
    }

    return {
        get current() {
            return settings;
        },
        init,
        toggleReduceMotion,
        toggleSolidSurfaces,
        toggleHighContrast,
        toggleFocusHighlight,
        toggleDyslexicFont,
        setFontScale,
        reset
    };
}

export const a11yStore = createA11yStore();

export const A11Y_TOGGLES: {
    key: 'reduceMotion' | 'solidSurfaces' | 'highContrast' | 'focusHighlight' | 'dyslexicFont';
    label: string;
    description: string;
    toggle: () => void;
}[] = [
    {
        key: 'reduceMotion',
        label: 'Reduce motion',
        description: 'Stop animations and background motion',
        toggle: a11yStore.toggleReduceMotion
    },
    {
        key: 'solidSurfaces',
        label: 'Solid surfaces',
        description: 'Remove frosted-glass transparency',
        toggle: a11yStore.toggleSolidSurfaces
    },
    {
        key: 'highContrast',
        label: 'High contrast text',
        description: 'Increase text contrast ratios',
        toggle: a11yStore.toggleHighContrast
    },
    {
        key: 'focusHighlight',
        label: 'Focus ring highlight',
        description: 'High-visibility keyboard focus outline',
        toggle: a11yStore.toggleFocusHighlight
    },
    {
        key: 'dyslexicFont',
        label: 'Dyslexic-friendly font',
        description: 'Switch the whole site to Lexend, except code',
        toggle: a11yStore.toggleDyslexicFont
    }
];
