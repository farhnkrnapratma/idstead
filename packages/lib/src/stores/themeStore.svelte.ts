import type { Theme } from '#lib/types.ts';
import { browser } from '$app/env';

function asTheme(value: string | null): Theme {
    return value === 'light' || value === 'dark' ? value : 'auto';
}

function readStoredTheme(): string | null {
    try {
        return localStorage.getItem('theme');
    } catch {
        return null;
    }
}

function createThemeStore() {
    let theme = $state<Theme>('auto');
    let isDark = $state(false);

    function checkIsDark(currentTheme: Theme): boolean {
        if (!browser) return false;
        if (currentTheme === 'dark') return true;
        if (currentTheme === 'light') return false;
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    function apply(newTheme: Theme) {
        theme = newTheme;
        if (!browser) return;
        try {
            localStorage.setItem('theme', newTheme);
        } catch (err) {
            void err;
        }
        isDark = checkIsDark(newTheme);
        document.documentElement.classList.toggle('dark', isDark);
    }

    function init() {
        if (!browser) return;
        apply(asTheme(readStoredTheme()));

        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const onMedia = () => {
            if (theme === 'auto') {
                isDark = media.matches;
                document.documentElement.classList.toggle('dark', isDark);
            }
        };
        const onStorage = (e: StorageEvent) => {
            if (e.key === 'theme') apply(asTheme(e.newValue));
        };

        media.addEventListener('change', onMedia);
        window.addEventListener('storage', onStorage);

        return () => {
            media.removeEventListener('change', onMedia);
            window.removeEventListener('storage', onStorage);
        };
    }

    function cycle(): Theme {
        const order: Theme[] = ['auto', 'light', 'dark'];
        const nextTheme = order[(order.indexOf(theme) + 1) % order.length];
        apply(nextTheme);
        return nextTheme;
    }

    return {
        get current() {
            return theme;
        },
        get isDark() {
            return isDark;
        },
        apply,
        cycle,
        init
    };
}

export const themeStore = createThemeStore();
