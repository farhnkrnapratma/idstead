import { describe, expect, test } from 'bun:test';
import {
    BUTTON_SHORTCUTS,
    CHORD_GROUPS,
    COMMAND_SHORTCUTS,
    leaderKeyFromEvent,
    normalizeKey,
    resolveShortcutAction,
    sequenceStep,
    type ShortcutDispatchState
} from '../packages/ui/src/shortcuts.ts';

function keydown(code: string, init: Partial<KeyboardEvent> = {}): KeyboardEvent {
    return {
        code,
        key: init.key ?? code,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        target: null,
        ...init
    } as KeyboardEvent;
}

function armed(overrides: Partial<ShortcutDispatchState> = {}): ShortcutDispatchState {
    return {
        leaderArmed: true,
        pendingGroup: null,
        hasGroupMembers: () => false,
        hasEntryFor: () => false,
        hasCommandFor: () => false,
        ...overrides
    };
}

describe('leaderKeyFromEvent', () => {
    test('reads arrow keys, slash and question mark', () => {
        expect(leaderKeyFromEvent(keydown('ArrowLeft'))).toBe('arrowleft');
        expect(leaderKeyFromEvent(keydown('ArrowDown'))).toBe('arrowdown');
        expect(leaderKeyFromEvent(keydown('Slash'))).toBe('/');
        expect(leaderKeyFromEvent(keydown('Slash', { shiftKey: true }))).toBe(
            normalizeKey(COMMAND_SHORTCUTS['/help'])
        );
    });

    test('matches the command map for arrows', () => {
        expect(leaderKeyFromEvent(keydown('ArrowLeft'))).toBe(
            normalizeKey(COMMAND_SHORTCUTS['/back'])
        );
    });
});

describe('go-to sequences', () => {
    test('a two-step combo joins the go group', () => {
        expect(sequenceStep(COMMAND_SHORTCUTS['/home'])).toEqual({ group: 'go', key: 'h' });
        expect(sequenceStep('Shift+D')).toBeNull();
    });

    test('G arms the go group when it has members', () => {
        const action = resolveShortcutAction(
            keydown('KeyG'),
            armed({ hasGroupMembers: group => group === 'go' })
        );
        expect(action).toEqual({ kind: 'arm', group: 'go', preventDefault: true });
    });

    test('the second step resolves as a chord', () => {
        const action = resolveShortcutAction(
            keydown('KeyH'),
            armed({ pendingGroup: 'go', hasGroupMembers: () => true })
        );
        expect(action.kind).toBe('chord');
    });
});

describe('key map', () => {
    test('no two bindings share a key unless a button mirrors its command', () => {
        const owners = new Map<string, string>();
        const claim = (combo: string, owner: string) => {
            const key = normalizeKey(combo);
            expect(owners.get(key), `${owner} clashes on ${key}`).toBeUndefined();
            owners.set(key, owner);
        };

        for (const [command, combo] of Object.entries(COMMAND_SHORTCUTS)) claim(combo, command);
        for (const group of Object.values(CHORD_GROUPS)) {
            for (const combo of group.combos) {
                if (group.shadows) {
                    expect(normalizeKey(COMMAND_SHORTCUTS[group.shadows])).toBe(
                        normalizeKey(combo)
                    );
                } else {
                    claim(combo, `group ${group.id}`);
                }
            }
        }
        for (const [id, { combo, mirrors }] of Object.entries(BUTTON_SHORTCUTS)) {
            if (mirrors) {
                expect(normalizeKey(combo), id).toBe(normalizeKey(COMMAND_SHORTCUTS[mirrors]));
            } else {
                claim(combo, id);
            }
        }
    });
});
