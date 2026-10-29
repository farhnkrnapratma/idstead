import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import {
    CHORD_GROUPS,
    shortcutLabelAt,
    normalizeKey,
    shortcutKeyParts,
    ARM_TIMEOUT_MS,
    TEXT_ENTRY_SELECTOR,
    resolveShortcutAction,
    chordKeyFromEvent
} from '../shortcuts.ts';
import { platformStore } from './platformStore.svelte';

export interface ShortcutEntry {
    id: string;
    combos: string[];
    group?: string;
    chordKey?: string;
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

let altHeld = $state(false);
let leaderArmed = $state(false);
let armedAt = $state(0);
let pendingGroup = $state<string | null>(null);
let catalogOpen = $state(false);
let scopeStack = $state<string[]>(['page']);
let modalScopes = $state<string[]>([]);

const entries = new SvelteMap<string, ShortcutEntry>();
const commands = new SvelteMap<string, CommandEntry>();

let seq = 0;
let armTimer: ReturnType<typeof setTimeout> | undefined;
let listening = false;
let disabled = false;

const activeScope = $derived(scopeStack[scopeStack.length - 1] ?? 'page');
const modalActive = $derived(modalScopes.length > 0);

function entryInScope(entry: ShortcutEntry) {
    if (entry.scope === activeScope) return true;
    if (modalActive) return false;
    return entry.scope === 'page';
}

/**
 * Chord labels are assigned by DOM order within a group, so database-driven
 * lists get stable labels without hardcoding anything. Index 0-9 then a-z;
 * anything past 36 items simply goes unlabelled.
 */
const chordAssignments = $derived.by(() => {
    const byGroup = new SvelteMap<string, ShortcutEntry[]>();
    for (const entry of entries.values()) {
        if (!entry.group || !entryInScope(entry)) continue;
        // A control rendered for both breakpoints registers twice. Numbering the
        // hidden copy would burn a key and shift every label after it.
        if (!entry.chordKey && !isVisible(entry)) continue;
        const bucket = byGroup.get(entry.group);
        if (bucket) bucket.push(entry);
        else byGroup.set(entry.group, [entry]);
    }

    const assigned = new SvelteMap<string, string>();
    for (const [, groupEntries] of byGroup) {
        const positional = groupEntries.filter(entry => !entry.chordKey);
        for (const entry of groupEntries) {
            if (entry.chordKey) assigned.set(entry.id, entry.chordKey);
        }
        const keyByLabel = new SvelteMap<string, string>();
        for (const entry of positional.sort((a, b) => compareDomOrder(a, b))) {
            let key = keyByLabel.get(entry.label);
            if (key === undefined) {
                key = shortcutLabelAt(keyByLabel.size);
                keyByLabel.set(entry.label, key);
            }
            if (key) assigned.set(entry.id, key);
        }
    }
    return assigned;
});

function compareDomOrder(a: ShortcutEntry, b: ShortcutEntry) {
    if (!a.element.isConnected || !b.element.isConnected) return a.order - b.order;
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
    armedAt = Date.now();
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

function groupCommandKey(groupId: string, chordKey: string) {
    const prefix = CHORD_GROUPS[groupId]?.combos[0];
    return prefix ? `${normalizeKey(prefix)} ${chordKey}` : '';
}

function groupHasMembers(groupId: string) {
    if ([...entries.values()].some(entry => entry.group === groupId && entryInScope(entry)))
        return true;
    const prefix = groupCommandKey(groupId, '');
    return (
        Boolean(prefix) && !modalActive && [...commands.keys()].some(key => key.startsWith(prefix))
    );
}

function armGroup(groupId: string) {
    if (disabled || !groupHasMembers(groupId)) return;
    armFor(groupId);
}

function trigger(entry: ShortcutEntry) {
    if (entry.element.matches(TEXT_ENTRY_SELECTOR)) entry.element.focus();
    else entry.element.click();
}

function matchEntry(key: string): ShortcutEntry | undefined {
    const matches = [...entries.values()].filter(
        entry => entryInScope(entry) && entry.combos.some(c => normalizeKey(c) === key)
    );
    const scoped = matches.filter(entry => entry.scope === activeScope);
    const pool = scoped.length > 0 ? scoped : matches;
    return pool.find(isVisible) ?? pool[0];
}

function matchEntryInForm(key: string, target: EventTarget | null): ShortcutEntry | undefined {
    const form =
        target instanceof Element ?
            (target.closest('form') ?? target.closest('[data-shortcut-scope]'))
        :   null;
    if (!form) return undefined;
    return [...entries.values()].find(
        entry =>
            entryInScope(entry)
            && form.contains(entry.element)
            && isVisible(entry)
            && entry.combos.some(c => normalizeKey(c) === key)
    );
}

function resolveChord(e: KeyboardEvent, group: string) {
    const chordKey = chordKeyFromEvent(e);
    if (!chordKey) return;
    const matches = [...entries.values()].filter(
        entry =>
            entry.group === group
            && entryInScope(entry)
            && chordAssignments.get(entry.id) === chordKey
    );
    const match = matches.find(isVisible) ?? matches[0];
    disarm();
    if (match) trigger(match);
    else if (!modalActive) commands.get(groupCommandKey(group, chordKey))?.run();
}

function handleKeydown(e: KeyboardEvent) {
    const action = resolveShortcutAction(e, {
        leaderArmed,
        pendingGroup,
        hasGroupMembers: groupHasMembers,
        hasEntryFor: key => Boolean(matchEntry(key)),
        hasScopedEntryFor: key => activeScope !== 'page' && matchEntry(key)?.scope === activeScope,
        hasEntryInForm: (key, target) => Boolean(matchEntryInForm(key, target)),
        modalActive,
        hasCommandFor: key => commands.has(key)
    });

    if (action.preventDefault) e.preventDefault();

    switch (action.kind) {
        case 'altDown':
            if (!altHeld) altHeld = true;
            return;
        case 'toggleLeader':
            if (leaderArmed) disarm();
            else armFor(null);
            return;
        case 'escape':
        case 'disarm':
            disarm();
            return;
        case 'chord':
            if (pendingGroup) resolveChord(e, pendingGroup);
            return;
        case 'catalog':
            disarm();
            catalogOpen = !catalogOpen;
            return;
        case 'arm':
            if (action.group) armFor(action.group);
            return;
        case 'entry': {
            disarm();
            if (!action.key) return;
            const match =
                action.inForm ? matchEntryInForm(action.key, e.target) : matchEntry(action.key);
            if (match) trigger(match);
            return;
        }
        case 'command': {
            disarm();
            if (action.key) commands.get(action.key)?.run();
            return;
        }
    }
}

function handleKeyup(e: KeyboardEvent) {
    if (e.key === 'Alt') altHeld = false;
}

function handleBlur() {
    altHeld = false;
    disarm();
}

function ensureListening() {
    if (disabled || listening || typeof window === 'undefined') return;
    listening = true;
    // Capture phase: the registry is the authoritative dispatcher, so it must see
    // a key before the palette's own window handler decides what to do with it.
    window.addEventListener('keydown', handleKeydown, true);
    window.addEventListener('keyup', handleKeyup);
    window.addEventListener('blur', handleBlur);
}

function register(entry: Omit<ShortcutEntry, 'id' | 'order'>): string {
    if (disabled) return '';
    ensureListening();
    for (const [key, existing] of entries) {
        if (!existing.element.isConnected) entries.delete(key);
    }
    const id = `shortcut-${++seq}`;
    entries.set(id, { ...entry, id, order: seq });
    return id;
}

function update(id: string, patch: Partial<Omit<ShortcutEntry, 'id'>>) {
    const existing = entries.get(id);
    if (!existing) return;
    const sameCombos =
        !patch.combos
        || (existing.combos.length === patch.combos.length
            && existing.combos.every((c, i) => c === patch.combos![i]));
    if (
        sameCombos
        && (patch.group === undefined || existing.group === patch.group)
        && (patch.chordKey === undefined || existing.chordKey === patch.chordKey)
        && (patch.label === undefined || existing.label === patch.label)
        && (patch.scope === undefined || existing.scope === patch.scope)
        && (patch.element === undefined || existing.element === patch.element)
    ) {
        return;
    }
    entries.set(id, { ...existing, ...patch });
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
    if (disabled) return () => {};
    ensureListening();
    const normalized = normalizeKey(key);
    commands.set(normalized, { key: normalized, label, run });
    return () => {
        if (commands.get(normalized)?.run === run) commands.delete(normalized);
    };
}

function runCommand(key: string) {
    commands.get(normalizeKey(key))?.run();
}

function pushScope(scope: string, modal = false) {
    if (disabled) return;
    scopeStack = [...scopeStack, scope];
    if (!modal) return;
    modalScopes = [...modalScopes, scope];
    disarm();
}

function popScope(scope: string) {
    if (disabled) return;
    const index = scopeStack.lastIndexOf(scope);
    if (index <= 0) return;
    scopeStack = [...scopeStack.slice(0, index), ...scopeStack.slice(index + 1)];
    if (!modalScopes.includes(scope)) return;
    modalScopes = modalScopes.filter(s => s !== scope);
    disarm();
}

function hintFor(id: string): string[] {
    if (!pendingGroup && !leaderArmed && !altHeld) return [];

    const entry = entries.get(id);
    if (!entry || !entryInScope(entry)) return [];

    if (entry.group) {
        const label = chordAssignments.get(id);
        if (!label) return [];
        if (pendingGroup === entry.group) return shortcutKeyParts(label, platformStore.current);
        if (pendingGroup || !(leaderArmed || altHeld)) return [];
        const prefix = CHORD_GROUPS[entry.group]?.combos[0];
        return shortcutKeyParts(prefix ?? label, platformStore.current);
    }

    if (pendingGroup || !(leaderArmed || altHeld)) return [];
    const combo = entry.combos[0];
    return combo ? shortcutKeyParts(combo, platformStore.current) : [];
}

function disable() {
    disabled = true;
    entries.clear();
    commands.clear();
    disarm();
    altHeld = false;
    catalogOpen = false;
    if (!listening) return;
    listening = false;
    window.removeEventListener('keydown', handleKeydown, true);
    window.removeEventListener('keyup', handleKeyup);
    window.removeEventListener('blur', handleBlur);
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
    get enabled() {
        return !disabled;
    },
    get altHeld() {
        return altHeld;
    },
    get leaderArmed() {
        return leaderArmed;
    },
    get armedAt() {
        return armedAt;
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
    runCommand,
    pushScope,
    popScope,
    armGroup,
    disarm,
    hintFor,
    catalogEntries,
    disable
};
