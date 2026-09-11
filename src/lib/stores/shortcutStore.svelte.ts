import {SvelteMap, SvelteSet} from 'svelte/reactivity';
import {
  CHORD_GROUPS,
  CATALOG_KEY,
  shortcutLabelAt,
  normalizeKey,
  displayKey,
  isLeaderEvent,
  leaderKeyFromEvent,
  chordKeyFromEvent
} from '$lib/shortcuts';

export interface ShortcutEntry {
  id: string;
  combos: string[];
  group?: string;
  label: string;
  scope: string;
  element: HTMLElement;
  order: number;
}

export interface ResolvedShortcut {
  id: string;
  combos: string[];
  group?: string;
  chordKey?: string;
  label: string;
  scope: string;
}

interface CommandEntry {
  key: string;
  label: string;
  run: () => void;
}

const ARM_TIMEOUT_MS = 5000;

let altHeld = $state(false);
let leaderArmed = $state(false);
let pendingGroup = $state<string | null>(null);
let catalogOpen = $state(false);
let scopeStack = $state<string[]>(['page']);

const entries = new SvelteMap<string, ShortcutEntry>();
const commands = new SvelteMap<string, CommandEntry>();

let seq = 0;
let armTimer: ReturnType<typeof setTimeout> | undefined;
let listening = false;

const activeScope = $derived(scopeStack[scopeStack.length - 1] ?? 'page');

/**
 * Chord labels are assigned by DOM order within a group, so database-driven
 * lists get stable labels without hardcoding anything. Index 0-9 then a-z;
 * anything past 36 items simply goes unlabelled.
 */
const chordAssignments = $derived.by(() => {
  const byGroup = new SvelteMap<string, ShortcutEntry[]>();
  for (const entry of entries.values()) {
    if (!entry.group || entry.scope !== activeScope) continue;
    // A control rendered for both breakpoints registers twice. Numbering the
    // hidden copy would burn a key and shift every label after it.
    if (!isVisible(entry)) continue;
    const bucket = byGroup.get(entry.group);
    if (bucket) bucket.push(entry);
    else byGroup.set(entry.group, [entry]);
  }

  const assigned = new SvelteMap<string, string>();
  for (const [, groupEntries] of byGroup) {
    groupEntries
      .slice()
      .sort((a, b) => compareDomOrder(a, b))
      .forEach((entry, index) => {
        const label = shortcutLabelAt(index);
        if (label) assigned.set(entry.id, label);
      });
  }
  return assigned;
});

function compareDomOrder(a: ShortcutEntry, b: ShortcutEntry) {
  if (!a.element.isConnected || !b.element.isConnected)
    return a.order - b.order;
  const position = a.element.compareDocumentPosition(b.element);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return a.order - b.order;
}

function disarm() {
  leaderArmed = false;
  pendingGroup = null;
  clearTimeout(armTimer);
}

function armFor(group: string | null) {
  leaderArmed = true;
  pendingGroup = group;
  clearTimeout(armTimer);
  armTimer = setTimeout(disarm, ARM_TIMEOUT_MS);
}

/**
 * A control rendered in both the nav and the footer has two entries, and only
 * one of them is on screen. offsetParent is not enough here: it is null for
 * every position:fixed control, which is exactly what the floating buttons are.
 */
function isVisible(entry: ShortcutEntry) {
  const el = entry.element;
  if (!el.isConnected) return false;
  if (typeof el.checkVisibility === 'function') return el.checkVisibility();
  return el.getClientRects().length > 0;
}

/**
 * Arms a chord from outside the keydown handler. The palette uses it so the
 * keypress after a command shortcut picks one of that command's options.
 */
function armGroup(groupId: string) {
  armFor(groupId);
}

function trigger(entry: ShortcutEntry) {
  entry.element.click();
}

function groupForKey(key: string): string | null {
  for (const group of Object.values(CHORD_GROUPS)) {
    if (group.combos.some(c => normalizeKey(c) === key)) return group.id;
  }
  return null;
}

function matchEntry(key: string): ShortcutEntry | undefined {
  const matches = [...entries.values()].filter(
    entry =>
      entry.scope === activeScope
      && entry.combos.some(c => normalizeKey(c) === key)
  );
  return matches.find(isVisible) ?? matches[0];
}

function resolveChord(e: KeyboardEvent, group: string) {
  const chordKey = chordKeyFromEvent(e);
  if (!chordKey) return;
  const match = [...entries.values()].find(
    entry =>
      entry.group === group
      && entry.scope === activeScope
      && chordAssignments.get(entry.id) === chordKey
  );
  disarm();
  // Swallow the key either way: the page is in shortcut mode, so a miss must
  // not leak through and scroll or type.
  e.preventDefault();
  if (match) trigger(match);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Alt') altHeld = true;

  if (isLeaderEvent(e)) {
    e.preventDefault();
    if (leaderArmed) disarm();
    else armFor(null);
    return;
  }

  if (!leaderArmed) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    disarm();
    return;
  }

  if (pendingGroup) {
    resolveChord(e, pendingGroup);
    return;
  }

  const key = leaderKeyFromEvent(e);
  if (!key) return;

  if (key === normalizeKey(CATALOG_KEY)) {
    e.preventDefault();
    disarm();
    catalogOpen = !catalogOpen;
    return;
  }

  const group = groupForKey(key);
  if (group) {
    const hasMembers = [...entries.values()].some(
      entry => entry.group === group && entry.scope === activeScope
    );
    if (hasMembers) {
      e.preventDefault();
      armFor(group);
      return;
    }
  }

  const direct = matchEntry(key);
  if (direct) {
    e.preventDefault();
    disarm();
    trigger(direct);
    return;
  }

  const command = commands.get(key);
  if (command) {
    e.preventDefault();
    disarm();
    command.run();
    return;
  }

  disarm();
}

function handleKeyup(e: KeyboardEvent) {
  if (e.key === 'Alt') altHeld = false;
}

function handleBlur() {
  altHeld = false;
  disarm();
}

function ensureListening() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  // Capture phase: the registry is the authoritative dispatcher, so it must see
  // a key before the palette's own window handler decides what to do with it.
  window.addEventListener('keydown', handleKeydown, true);
  window.addEventListener('keyup', handleKeyup);
  window.addEventListener('blur', handleBlur);
}

function register(entry: Omit<ShortcutEntry, 'id' | 'order'>): string {
  ensureListening();
  const id = `shortcut-${++seq}`;
  entries.set(id, {...entry, id, order: seq});
  return id;
}

function update(id: string, patch: Partial<Omit<ShortcutEntry, 'id'>>) {
  const existing = entries.get(id);
  if (!existing) return;
  entries.set(id, {...existing, ...patch});
}

function unregister(id: string) {
  entries.delete(id);
}

/**
 * Commands have no element to click, so they register a callback instead. This
 * keeps every leader key resolved in one place rather than split between the
 * registry and the palette's own listener.
 */
function registerCommand(key: string, label: string, run: () => void) {
  ensureListening();
  const normalized = normalizeKey(key);
  commands.set(normalized, {key: normalized, label, run});
  return () => {
    if (commands.get(normalized)?.run === run) commands.delete(normalized);
  };
}

function pushScope(scope: string) {
  scopeStack = [...scopeStack, scope];
  disarm();
}

function popScope(scope: string) {
  const index = scopeStack.lastIndexOf(scope);
  if (index <= 0) return;
  scopeStack = [...scopeStack.slice(0, index), ...scopeStack.slice(index + 1)];
  disarm();
}

/** The label a button should show right now, or '' when nothing is revealed. */
function hintFor(id: string): string {
  if (!pendingGroup && !leaderArmed && !altHeld) return '';

  const entry = entries.get(id);
  if (!entry || entry.scope !== activeScope) return '';

  if (entry.group) {
    const label = chordAssignments.get(id);
    if (!label) return '';
    // Once the group is armed the prefix is spent, so only the item key is left
    // to press.
    if (pendingGroup === entry.group) return label;
    if (pendingGroup || !(leaderArmed || altHeld)) return '';
    const prefix = CHORD_GROUPS[entry.group]?.combos[0];
    // Show the whole path while peeking. A bare "0" would advertise a key that
    // does nothing until its group is armed.
    return prefix ? `${displayKey(prefix)} ${label}` : label;
  }

  if (pendingGroup || !(leaderArmed || altHeld)) return '';
  const combo = entry.combos[0];
  return combo ? displayKey(combo) : '';
}

function catalogEntries(): ResolvedShortcut[] {
  const seen = new SvelteSet<string>();
  return [...entries.values()]
    .map(entry => ({
      id: entry.id,
      combos: entry.combos,
      group: entry.group,
      chordKey: chordAssignments.get(entry.id),
      label: entry.label,
      scope: entry.scope
    }))
    .filter(entry => !entry.group || entry.chordKey)
    .filter(entry => {
      // The same control can be mounted twice; list it once.
      const key = `${entry.group ?? ''}|${entry.label}|${entry.combos.join()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export const shortcutStore = {
  get altHeld() {
    return altHeld;
  },
  get leaderArmed() {
    return leaderArmed;
  },
  get pendingGroup() {
    return pendingGroup;
  },
  get activeScope() {
    return activeScope;
  },
  get catalogOpen() {
    return catalogOpen;
  },
  set catalogOpen(value: boolean) {
    catalogOpen = value;
  },
  register,
  update,
  unregister,
  registerCommand,
  pushScope,
  popScope,
  armGroup,
  disarm,
  hintFor,
  catalogEntries
};
