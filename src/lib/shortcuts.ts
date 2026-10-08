import type {Platform} from './platform';

export const SHORTCUT_LABELS = '0123456789abcdefghijklmnopqrstuvwxyz';

export function shortcutLabelAt(index: number): string {
  return SHORTCUT_LABELS[index] ?? '';
}

export interface ChordGroupSpec {
  id: string;
  label: string;
  combos: string[];
  shadows?: string;
  listed?: boolean;
}

/**
 * The leader. Ctrl+Space arms shortcut mode; every other binding is a plain key
 * pressed afterwards, so nothing competes with the browser's own accelerators.
 * Cmd+Space is deliberately not accepted: macOS Spotlight owns it and no page
 * can cancel it.
 */
export const LEADER_COMBO = 'Ctrl+Space';

export const LEADER_FALLBACK_COMBO = 'Ctrl+Shift+Space';

/** Pressed after the leader to open the shortcut catalog. */
export const CATALOG_KEY = 'Space';

export const CHORD_GROUPS: Record<string, ChordGroupSpec> = {
  social: {
    id: 'social',
    label: 'Social links',
    combos: ['Shift+S'],
    listed: false
  },
  contact: {
    id: 'contact',
    label: 'Contact channels',
    combos: ['Shift+C'],
    listed: false
  },
  funding: {
    id: 'funding',
    label: 'Funding platforms',
    combos: ['Shift+U'],
    listed: false
  },
  posts: {id: 'posts', label: 'Blog posts', combos: ['Shift+B'], listed: false},
  projects: {
    id: 'projects',
    label: 'Projects',
    combos: ['Shift+J'],
    listed: false
  },
  sidebar: {id: 'sidebar', label: 'Admin sidebar', combos: ['Shift+A']},
  copy: {id: 'copy', label: 'Copy', combos: ['C'], shadows: '/copy'},
  save: {id: 'save', label: 'Save', combos: ['S'], shadows: '/save'},
  code: {id: 'code', label: 'Code blocks', combos: ['E'], shadows: '/code'},
  view: {id: 'view', label: 'View', combos: ['Shift+V']},
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
  readingMode: {combo: 'D', mirrors: '/read'},
  subscribe: {combo: 'Shift+H'},
  feedback: {combo: 'Shift+D', mirrors: '/feedback'},
  readingOptions: {combo: 'Shift+R'},
  notifications: {combo: 'Shift+N'},
  dialogClose: {combo: 'Esc'},
  skipLink: {combo: 'Enter'},
  filterSearch: {combo: 'Shift+Q'},
  sortDirection: {combo: 'Shift+T'},
  clearFilters: {combo: 'Shift+W'},
  pagePrev: {combo: '['},
  pageNext: {combo: ']'},
  formClear: {combo: 'Shift+Z'},
  formSubmit: {combo: 'Shift+Y'},
  browseProjects: {combo: 'J', mirrors: '/projects'},
  viewAllProjects: {combo: 'J', mirrors: '/projects'},
  viewAllPosts: {combo: 'B', mirrors: '/blog'},
  getInTouch: {combo: 'N', mirrors: '/contact'},
  viewFullCv: {combo: 'V', mirrors: '/cv'},
  becomeSponsor: {combo: 'U', mirrors: '/funding'},
  feed: {combo: 'R', mirrors: '/rss'},
  termsLink: {combo: 'M', mirrors: '/terms'},
  privacyLink: {combo: 'Y', mirrors: '/privacy'},
  securityLink: {combo: 'K', mirrors: '/security'},
  cookiesLink: {combo: 'Shift+K', mirrors: '/cookies'},
  sitemapLink: {combo: 'Shift+M', mirrors: '/sitemap'},
  moreActions: {combo: '.'},
  tldr: {combo: 'Alt+T'},
  summary: {combo: 'Alt+S'},
  helpfulYes: {combo: 'Alt+Y'},
  helpfulNo: {combo: 'Alt+N'},
  shareFeedback: {combo: 'Alt+F'},
  share: {combo: 'Shift+E', mirrors: '/share'}
};

export function buttonKey(id: keyof typeof BUTTON_SHORTCUTS | string): string {
  return BUTTON_SHORTCUTS[id]?.combo ?? '';
}

export const COMMAND_ARG_KEYS = {
  '/copy': {url: 'U', pid: 'P', md: 'M', txt: 'T'},
  '/save': {cv: 'C', md: 'M', txt: 'T'},
  '/code': {theme: 'T', wrap: 'W', lines: 'L', clean: 'C'}
} as const;

export const VIEW_FORMAT_KEYS = {md: 'M', txt: 'T'} as const;

type ArgCommand = keyof typeof COMMAND_ARG_KEYS;

export function argKey<C extends ArgCommand>(
  command: C,
  arg: keyof (typeof COMMAND_ARG_KEYS)[C]
): string {
  return COMMAND_ARG_KEYS[command][arg] as string;
}

export function sectionCommandKey(target: string): string {
  const section =
    target === '/' ? 'home' : target.replace(/^\/?#?/, '').split(/[/?#]/)[0];
  return COMMAND_SHORTCUTS[`/${section || 'home'}`] ?? '';
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
  '/feedback': 'Shift+D',
  '/llms': 'Shift+L',
  '/cookies': 'Shift+K',
  '/sitemap': 'Shift+M',
  '/api': 'Shift+I',
  '/share': 'Shift+E',
  '/exit': 'Shift+X',
  '/keyboard': 'Space',
  '/help': 'Shift+F'
};

export const COMMAND_LABELS: Record<string, string> = {
  '/home': 'Home',
  '/projects': 'Projects',
  '/blog': 'Blog',
  '/cv': 'CV',
  '/funding': 'Funding',
  '/contact': 'Contact',
  '/privacy': 'Privacy policy',
  '/terms': 'Terms of service',
  '/security': 'Security policy',
  '/read': 'Reading mode',
  '/open': 'Search',
  '/refresh': 'Refresh',
  '/theme': 'Theme',
  '/font': 'Reading font',
  '/code': 'Code blocks',
  '/a11y': 'Accessibility',
  '/copy': 'Copy',
  '/save': 'Save',
  '/back': 'Back',
  '/forward': 'Forward',
  '/top': 'Scroll to top',
  '/bottom': 'Scroll to bottom',
  '/print': 'Print',
  '/rss': 'RSS feed',
  '/qr': 'QR code',
  '/feedback': 'Feedback',
  '/llms': 'LLM guide',
  '/cookies': 'Cookie settings',
  '/sitemap': 'Sitemap',
  '/api': 'API docs',
  '/share': 'Share',
  '/exit': 'Exit',
  '/help': 'Help'
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
  for (const group of Object.values(CHORD_GROUPS)) {
    for (const combo of group.combos) {
      const shadowed = group.shadows && COMMAND_SHORTCUTS[group.shadows];
      if (shadowed && normalizeKey(shadowed) === normalizeKey(combo)) continue;
      claim(combo);
    }
  }
  for (const [command, key] of Object.entries(COMMAND_SHORTCUTS)) {
    if (
      command === '/keyboard'
      && normalizeKey(key) === normalizeKey(CATALOG_KEY)
    ) {
      continue;
    }
    claim(key);
  }
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
  const has = (name: string) => parts.some(part => part.toLowerCase() === name);
  const alt = has('alt') || has('option');
  return `${alt ? 'alt+' : ''}${has('shift') ? 'shift+' : ''}${key}`;
}

export const ARM_TIMEOUT_MS = 5000;

const KEY_TOKENS: Record<string, string> = {
  mod: 'Mod',
  shift: 'Shift',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  meta: 'Meta',
  cmd: 'Meta',
  command: 'Meta',
  win: 'Meta',
  super: 'Meta',
  space: 'Space',
  esc: 'Esc',
  escape: 'Esc',
  enter: 'Enter',
  return: 'Enter',
  tab: 'Tab',
  capslock: 'CapsLock',
  pageup: 'PageUp',
  pgup: 'PageUp',
  pagedown: 'PageDown',
  pgdn: 'PageDown',
  slash: '/'
};

const MODIFIER_ORDER: Record<'mac' | 'default', string[]> = {
  mac: ['Ctrl', 'Alt', 'Shift', 'Mod', 'Meta'],
  default: ['Mod', 'Ctrl', 'Alt', 'Shift', 'Meta']
};

function tokenFor(part: string): string {
  return KEY_TOKENS[part.toLowerCase()] ?? part.toUpperCase();
}

export function shortcutKeyParts(
  spec: string,
  platform: Platform = 'other'
): string[] {
  const order = MODIFIER_ORDER[platform === 'mac' ? 'mac' : 'default'];
  return spec
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap(step => {
      const expanded = step.replace(/^⇧/, 'Shift+');
      const tokens = expanded
        .split('+')
        .map(part => part.trim())
        .filter(Boolean)
        .map(tokenFor);
      const modifiers = tokens
        .filter(token => order.includes(token))
        .sort((a, b) => order.indexOf(a) - order.indexOf(b));
      return [...modifiers, ...tokens.filter(token => !order.includes(token))];
    });
}

export type KeyIcon =
  | 'Command'
  | 'Option'
  | 'ChevronUp'
  | 'ArrowBigUp'
  | 'CornerDownLeft'
  | 'ArrowRightToLine'
  | 'ArrowBigUpDash';

export interface KeyLabel {
  text: string;
  name: string;
  icon?: KeyIcon;
}

const MAC_KEYS: Record<string, KeyLabel> = {
  Mod: {text: '⌘', name: 'Command', icon: 'Command'},
  Meta: {text: '⌘', name: 'Command', icon: 'Command'},
  Ctrl: {text: '⌃', name: 'Control', icon: 'ChevronUp'},
  Alt: {text: '⌥', name: 'Option', icon: 'Option'},
  Shift: {text: '⇧', name: 'Shift', icon: 'ArrowBigUp'},
  Enter: {text: '↩', name: 'Return', icon: 'CornerDownLeft'},
  Tab: {text: '⇥', name: 'Tab', icon: 'ArrowRightToLine'},
  CapsLock: {text: '⇪', name: 'Caps Lock', icon: 'ArrowBigUpDash'},
  PageUp: {text: '⇞', name: 'Page Up'},
  PageDown: {text: '⇟', name: 'Page Down'}
};

const PC_KEYS: Record<string, KeyLabel> = {
  Mod: {text: 'Ctrl', name: 'Control'},
  Ctrl: {text: 'Ctrl', name: 'Control'},
  Alt: {text: 'Alt', name: 'Alt'},
  Shift: {text: 'Shift', name: 'Shift'},
  Enter: {text: 'Enter', name: 'Enter'},
  Tab: {text: 'Tab', name: 'Tab'},
  CapsLock: {text: 'Caps Lock', name: 'Caps Lock'},
  PageUp: {text: 'PgUp', name: 'Page Up'},
  PageDown: {text: 'PgDn', name: 'Page Down'}
};

const META_BY_PLATFORM: Record<Platform, KeyLabel> = {
  mac: MAC_KEYS.Meta,
  windows: {text: 'Win', name: 'Windows'},
  linux: {text: 'Super', name: 'Super'},
  other: {text: 'Meta', name: 'Meta'}
};

export function keyLabel(
  token: string,
  platform: Platform = 'other'
): KeyLabel {
  if (token === 'Meta') return META_BY_PLATFORM[platform];
  const table = platform === 'mac' ? MAC_KEYS : PC_KEYS;
  return table[token] ?? {text: token, name: token};
}

export function shortcutText(
  spec: string,
  platform: Platform = 'other'
): string {
  const texts = shortcutKeyParts(spec, platform).map(
    token => keyLabel(token, platform).text
  );
  return texts.join(platform === 'mac' ? ' ' : '+');
}

const PUNCTUATION_CODES: Record<string, string> = {
  BracketLeft: '[',
  BracketRight: ']',
  Comma: ',',
  Period: '.'
};

/** Ctrl+Space, and never Cmd+Space, which macOS Spotlight owns. */
export function isLeaderEvent(e: KeyboardEvent): boolean {
  return Boolean(e.ctrlKey) && !e.altKey && !e.metaKey && e.code === 'Space';
}

/**
 * The key pressed after the leader. Built from event.code rather than event.key
 * so bindings survive non-QWERTY layouts and Shift, which rewrites event.key.
 */
export function leaderKeyFromEvent(e: KeyboardEvent): string | null {
  if (e.ctrlKey || e.metaKey) return null;
  const code = e.code || '';
  let key: string;
  if (code.startsWith('Key')) key = code.slice(3).toLowerCase();
  else if (code.startsWith('Digit')) key = code.slice(5);
  else if (code.startsWith('Numpad') && /\d$/.test(code)) key = code.slice(-1);
  else if (code === 'Slash') key = 'slash';
  else if (code === 'Space') key = 'space';
  else if (code === 'Enter' || code === 'NumpadEnter') key = 'enter';
  else if (code in PUNCTUATION_CODES) key = PUNCTUATION_CODES[code];
  else return null;
  return `${e.altKey ? 'alt+' : ''}${e.shiftKey ? 'shift+' : ''}${key}`;
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

const NON_TEXT_INPUT_TYPES = [
  'radio',
  'checkbox',
  'button',
  'submit',
  'reset',
  'range',
  'color',
  'file',
  'image'
];

export const TEXT_ENTRY_SELECTOR = [
  `input${NON_TEXT_INPUT_TYPES.map(type => `:not([type="${type}"])`).join('')}`,
  'textarea',
  'select',
  '[contenteditable="true"]'
].join(', ');

export function isTextEntryTarget(target: unknown): boolean {
  const el = target as
    | (Partial<HTMLInputElement> & {closest?: (s: string) => unknown})
    | null
    | undefined;
  if (!el) return false;
  if (typeof el.closest === 'function' && el.closest(TEXT_ENTRY_SELECTOR)) {
    return true;
  }
  if (el.tagName === 'INPUT') {
    return !NON_TEXT_INPUT_TYPES.includes((el.type || 'text').toLowerCase());
  }
  if (['TEXTAREA', 'SELECT'].includes(el.tagName || '')) return true;
  return Boolean(el.isContentEditable);
}

export function groupForKey(key: string): string | null {
  for (const group of Object.values(CHORD_GROUPS)) {
    if (group.combos.some(c => normalizeKey(c) === key)) return group.id;
  }
  return null;
}

export interface ShortcutDispatchState {
  leaderArmed: boolean;
  pendingGroup: string | null;
  modalActive?: boolean;
  hasGroupMembers: (groupId: string) => boolean;
  hasEntryFor: (key: string) => boolean;
  hasScopedEntryFor?: (key: string) => boolean;
  hasEntryInForm?: (key: string, target: EventTarget | null) => boolean;
  hasCommandFor: (key: string) => boolean;
}

export interface ShortcutAction {
  kind:
    | 'ignore'
    | 'altDown'
    | 'toggleLeader'
    | 'escape'
    | 'chord'
    | 'catalog'
    | 'arm'
    | 'entry'
    | 'command'
    | 'disarm';
  key?: string;
  group?: string;
  inForm?: boolean;
  preventDefault: boolean;
}

export function resolveShortcutAction(
  e: KeyboardEvent,
  state: ShortcutDispatchState
): ShortcutAction {
  if (e.key === 'Alt') return {kind: 'altDown', preventDefault: false};
  if (isLeaderEvent(e)) return {kind: 'toggleLeader', preventDefault: true};
  if (!state.leaderArmed) return {kind: 'ignore', preventDefault: false};
  if (e.key === 'Escape') return {kind: 'escape', preventDefault: true};
  if (isTextEntryTarget(e.target)) {
    const typed = leaderKeyFromEvent(e);
    if (!typed) return {kind: 'ignore', preventDefault: false};
    if (!state.pendingGroup && state.hasEntryInForm?.(typed, e.target)) {
      return {kind: 'entry', key: typed, inForm: true, preventDefault: true};
    }
    return {kind: 'disarm', preventDefault: false};
  }
  if (state.pendingGroup) return {kind: 'chord', preventDefault: true};

  const key = leaderKeyFromEvent(e);
  if (!key) return {kind: 'ignore', preventDefault: false};

  if (key === normalizeKey(CATALOG_KEY))
    return {kind: 'catalog', preventDefault: true};

  if (state.hasScopedEntryFor?.(key))
    return {kind: 'entry', key, preventDefault: true};

  const group = groupForKey(key);
  if (group && state.hasGroupMembers(group))
    return {kind: 'arm', group, preventDefault: true};

  if (state.hasEntryFor(key)) return {kind: 'entry', key, preventDefault: true};
  if (!state.modalActive && state.hasCommandFor(key))
    return {kind: 'command', key, preventDefault: true};

  return {kind: 'disarm', preventDefault: false};
}
