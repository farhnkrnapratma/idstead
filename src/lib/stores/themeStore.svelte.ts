/** @format */

import type {Theme} from '$lib/types'
import {browser} from '$app/environment'

function createThemeStore() {
  let theme = $state<Theme>('auto')

  function apply(newTheme: Theme) {
    theme = newTheme
    if (!browser) return
    localStorage.setItem('theme', newTheme)
    const isDark =
      newTheme === 'dark'
      || (newTheme === 'auto'
        && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', isDark)
  }

  function init() {
    if (!browser) return
    const saved = (localStorage.getItem('theme') as Theme) || 'auto'
    apply(saved)

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onMedia = () => {
      if (theme === 'auto') apply('auto')
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'theme') apply((e.newValue as Theme) || 'auto')
    }

    media.addEventListener('change', onMedia)
    window.addEventListener('storage', onStorage)

    return () => {
      media.removeEventListener('change', onMedia)
      window.removeEventListener('storage', onStorage)
    }
  }

  return {
    get current() {
      return theme
    },
    apply,
    init
  }
}

export const themeStore = createThemeStore()
