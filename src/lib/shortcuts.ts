export const SHORTCUT_LABELS = '0123456789abcdefghijklmnopqrstuvwxyz';

export function shortcutLabelAt(index: number): string {
  return SHORTCUT_LABELS[index] ?? '';
}

export interface ChordGroupSpec {
  id: string;
  label: string;
  combos: string[];
}

/**
 * The leader. Ctrl+Space arms shortcut mode; every other binding is a plain key
 * pressed afterwards, so nothing competes with the browser's own accelerators.
 * Cmd+Space is deliberately not accepted: macOS Spotlight owns it and no page
 * can cancel it.
 */
export const LEADER_COMBO = 'Ctrl+Space';

/** Pressed after the leader to open the shortcut catalog. */
export const CATALOG_KEY = 'Space';

export const CHORD_GROUPS: Record<string, ChordGroupSpec> = {
  social: {id: 'social', label: 'Social links', combos: ['Shift+S']},
  contact: {id: 'contact', label: 'Contact channels', combos: ['Shift+C']},
  funding: {id: 'funding', label: 'Funding platforms', combos: ['Shift+U']},
  posts: {id: 'posts', label: 'Blog results', combos: ['Shift+B']},
  projects: {id: 'projects', label: 'Repository results', combos: ['Shift+J']},
  actions: {id: 'actions', label: 'Buttons on this page', combos: ['Shift+P']},
  nav: {id: 'nav', label: 'Navigation items', combos: ['Shift+G']},
  sidebar: {id: 'sidebar', label: 'Admin sidebar', combos: ['Shift+A']},
  // Armed by a command shortcut rather than a typed prefix, so it owns no key.
  args: {id: 'args', label: 'Command options', combos: []}
};

/**
 * Keys owned by concrete buttons. A button that mirrors a slash command
 * deliberately shares its key: the button answers at page scope, the command
 * answers inside the open palette, so the two never compete.
 */
export const BUTTON_SHORTCUTS: Record<
  string,
  {combo: string; mirrors?: string}
> = {
  back: {combo: 'Z', mirrors: '/back'},
  scrollTop: {combo: 'W', mirrors: '/top'},
  themeToggle: {combo: 'T', mirrors: '/theme'},
  contentFont: {combo: 'F', mirrors: '/font'},
  accessibility: {combo: 'I', mirrors: '/a11y'},
  language: {combo: 'L', mirrors: '/lang'},
  readingMode: {combo: 'D', mirrors: '/read'},
  feedback: {combo: 'Shift+D', mirrors: '/feedback'},
  readingOptions: {combo: 'Shift+R'},
  notifications: {combo: 'Shift+N'},
  dialogClose: {combo: 'Esc'}
};

export function buttonKey(id: keyof typeof BUTTON_SHORTCUTS | string): string {
  return BUTTON_SHORTCUTS[id]?.combo ?? '';
}

/**
 * One key per slash command, pressed after the leader. The 26 bare letters are
 * fully allocated, so the overflow sits on Shift+letter. Ctrl+K and "/" belong
 * to the command palette itself and are deliberately absent.
 */
export const COMMAND_SHORTCUTS: Record<string, string> = {
  '/home': 'H',
  '/projects': 'J',
  '/blog': 'B',
  '/cv': 'V',
  '/funding': 'U',
  '/contact': 'N',
  '/privacy': 'Y',
  '/terms': 'M',
  '/security': 'K',
  '/read': 'D',
  '/open': 'O',
  '/refresh': 'G',
  '/theme': 'T',
  '/font': 'F',
  '/code': 'E',
  '/a11y': 'I',
  '/copy': 'C',
  '/save': 'S',
  '/back': 'Z',
  '/forward': 'X',
  '/top': 'W',
  '/bottom': 'A',
  '/print': 'P',
  '/rss': 'R',
  '/qr': 'Q',
  '/lang': 'L',
  '/feedback': 'Shift+D',
  '/llms': 'Shift+L',
  '/cookies': 'Shift+K',
  '/history': 'Shift+H',
  '/sitemap': 'Shift+M',
  '/api': 'Shift+I',
  '/share': 'Shift+E',
  '/exit': 'Shift+X',
  '/help': 'Shift+F'
};

/**
 * Every key bound at leader level must be unique, otherwise one binding
 * silently shadows another. Returns the keys claimed more than once.
 */
export function findShortcutCollisions(): string[] {
  const seen = new Map<string, number>();
  const claim = (key: string) => {
    const normalized = normalizeKey(key);
    seen.set(normalized, (seen.get(normalized) ?? 0) + 1);
  };

  claim(CATALOG_KEY);
  for (const group of Object.values(CHORD_GROUPS)) group.combos.forEach(claim);
  Object.values(COMMAND_SHORTCUTS).forEach(claim);
  for (const button of Object.values(BUTTON_SHORTCUTS)) {
    // A mirrored button shares its command's key on purpose.
    if (button.mirrors && COMMAND_SHORTCUTS[button.mirrors] === button.combo) {
      continue;
    }
    // Esc never reaches leader dispatch; it is a badge for the dialog handler.
    if (normalizeKey(button.combo) === 'esc') continue;
    claim(button.combo);
  }

  return [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
}

/** Canonical form so "Shift+D", "shift+d" and " D " all compare predictably. */
export function normalizeKey(spec: string): string {
  const parts = spec
    .split('+')
    .map(part => part.trim())
    .filter(Boolean);
  const key = (parts.pop() ?? '').toLowerCase();
  const shifted = parts.some(part => part.toLowerCase() === 'shift');
  return shifted ? `shift+${key}` : key;
}

/** How a key reads on a badge: "Shift+P" renders as "⇧P". */
export function displayKey(spec: string): string {
  const normalized = normalizeKey(spec);
  if (normalized.startsWith('shift+')) {
    return `⇧${normalized.slice(6).toUpperCase()}`;
  }
  if (normalized === 'space') return 'Space';
  if (normalized === 'esc') return 'Esc';
  if (normalized === 'slash') return '/';
  return normalized.toUpperCase();
}

/** Ctrl+Space, and never Cmd+Space, which macOS Spotlight owns. */
export function isLeaderEvent(e: KeyboardEvent): boolean {
  return Boolean(e.ctrlKey) && !e.altKey && !e.metaKey && e.code === 'Space';
}

/**
 * The key pressed after the leader. Built from event.code rather than event.key
 * so bindings survive non-QWERTY layouts and Shift, which rewrites event.key.
 */
export function leaderKeyFromEvent(e: KeyboardEvent): string | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const code = e.code || '';
  let key: string;
  if (code.startsWith('Key')) key = code.slice(3).toLowerCase();
  else if (code.startsWith('Digit')) key = code.slice(5);
  else if (code.startsWith('Numpad') && /\d$/.test(code)) key = code.slice(-1);
  else if (code === 'Slash') key = 'slash';
  else if (code === 'Space') key = 'space';
  else return null;
  return e.shiftKey ? `shift+${key}` : key;
}

/** The single key that resolves a pending chord: no modifiers, 0-9 or a-z. */
export function chordKeyFromEvent(e: KeyboardEvent): string | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const code = e.code || '';
  if (code.startsWith('Key')) return code.slice(3).toLowerCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad') && /\d$/.test(code)) return code.slice(-1);
  return null;
}
