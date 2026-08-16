import {browser} from '$app/environment'
import type {CodeColorScheme} from '$lib/utils/hljsTheme'

interface CodeBlockPrefs {
  colorScheme: CodeColorScheme
  lineNumbers: boolean
  wrap: boolean
}

const STORAGE_KEY = 'codeblock_prefs'

const defaults: CodeBlockPrefs = {
  colorScheme: 'auto',
  lineNumbers: true,
  wrap: false
}

function createCodeBlockPrefsStore() {
  let prefs = $state<CodeBlockPrefs>({...defaults})
  let onExternalChange: (() => void) | null = null

  function persist() {
    if (!browser) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  }

  function apply(next: Partial<CodeBlockPrefs>) {
    prefs = {...prefs, ...next}
    persist()
  }

  function parseStored(raw: string | null): Partial<CodeBlockPrefs> {
    if (!raw) return {}
    try {
      const parsed = JSON.parse(raw)
      return typeof parsed === 'object' && parsed !== null ? parsed : {}
    } catch {
      return {}
    }
  }

  function cycleColorScheme() {
    const order: CodeColorScheme[] = ['auto', 'light', 'dark']
    const next = order[(order.indexOf(prefs.colorScheme) + 1) % order.length]
    apply({colorScheme: next})
  }

  function toggleLineNumbers() {
    apply({lineNumbers: !prefs.lineNumbers})
  }

  function toggleWrap() {
    apply({wrap: !prefs.wrap})
  }

  function init(onChange?: () => void) {
    if (!browser) return
    onExternalChange = onChange || null

    const stored = parseStored(localStorage.getItem(STORAGE_KEY))
    prefs = {...defaults, ...stored}

    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      prefs = {...defaults, ...parseStored(e.newValue)}
      onExternalChange?.()
    }

    window.addEventListener('storage', onStorage)

    return () => {
      window.removeEventListener('storage', onStorage)
      onExternalChange = null
    }
  }

  return {
    get current() {
      return prefs
    },
    init,
    apply,
    cycleColorScheme,
    toggleLineNumbers,
    toggleWrap
  }
}

export const codeBlockPrefsStore = createCodeBlockPrefsStore()
