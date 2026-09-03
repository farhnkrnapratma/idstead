import type {Theme} from '$lib/types';
import {browser} from '$app/environment';

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
    localStorage.setItem('theme', newTheme);
    isDark = checkIsDark(newTheme);
    document.documentElement.classList.toggle('dark', isDark);
  }

  function init() {
    if (!browser) return;
    const saved = (localStorage.getItem('theme') as Theme) || 'auto';
    apply(saved);

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onMedia = () => {
      if (theme === 'auto') {
        isDark = media.matches;
        document.documentElement.classList.toggle('dark', isDark);
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'theme') apply((e.newValue as Theme) || 'auto');
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

  function toggle(): Theme {
    return cycle();
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
    toggle,
    init
  };
}

export const themeStore = createThemeStore();
