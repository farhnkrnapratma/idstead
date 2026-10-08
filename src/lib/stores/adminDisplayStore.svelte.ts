import {browser} from '$app/env';
import {
  DEFAULT_ADMIN_DISPLAY,
  parseAdminDisplayPrefs,
  type AdminDisplayPrefs
} from '#lib/adminDateFormat.ts';

const STORAGE_KEY = 'admin-display';

function readStored(raw: string | null): AdminDisplayPrefs {
  return {...DEFAULT_ADMIN_DISPLAY, ...parseAdminDisplayPrefs(raw)};
}

function loadInitial(): AdminDisplayPrefs {
  if (!browser) return {...DEFAULT_ADMIN_DISPLAY};
  try {
    return readStored(localStorage.getItem(STORAGE_KEY));
  } catch {
    return {...DEFAULT_ADMIN_DISPLAY};
  }
}

function createAdminDisplayStore() {
  let prefs = $state<AdminDisplayPrefs>(loadInitial());

  function apply(next: Partial<AdminDisplayPrefs>) {
    prefs = {...prefs, ...next};
    if (!browser) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {}
  }

  function init() {
    if (!browser) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      prefs = readStored(event.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }

  function reset() {
    apply({...DEFAULT_ADMIN_DISPLAY});
  }

  return {
    get current() {
      return prefs;
    },
    apply,
    init,
    reset
  };
}

export const adminDisplayStore = createAdminDisplayStore();
