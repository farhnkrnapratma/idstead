import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {detectPlatform} from '../src/lib/platform';
import {
  findShortcutCollisions,
  normalizeKey,
  shortcutKeyParts,
  isLeaderEvent,
  leaderKeyFromEvent,
  chordKeyFromEvent,
  isTextEntryTarget,
  resolveShortcutAction,
  groupForKey,
  shortcutLabelAt,
  buttonKey,
  SHORTCUT_LABELS,
  LEADER_COMBO,
  LEADER_FALLBACK_COMBO,
  COMMAND_ARG_KEYS,
  argKey,
  sectionCommandKey,
  keyLabel,
  shortcutText,
  CATALOG_KEY,
  CHORD_GROUPS,
  BUTTON_SHORTCUTS,
  COMMAND_SHORTCUTS,
  COMMAND_LABELS
} from '../src/lib/shortcuts';

function keyEvent(init: {
  code: string;
  key?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  target?: unknown;
}) {
  return init as unknown as KeyboardEvent;
}

const IDLE = {
  leaderArmed: false,
  pendingGroup: null,
  hasGroupMembers: () => false,
  hasEntryFor: () => false,
  hasCommandFor: () => false
};

const ARMED = {...IDLE, leaderArmed: true};

test('shortcut keys preserve browser modifiers, chord assignments and collision checks', () => {
  assert.deepEqual(
    findShortcutCollisions(),
    [],
    'every leader-level key must be unique'
  );

  assert.equal(normalizeKey('Shift+D'), 'shift+d');
  assert.equal(normalizeKey(' t '), 't');
  assert.equal(normalizeKey('Esc'), 'esc');
  assert.equal(normalizeKey('Alt+t'), 'alt+t');
  assert.equal(normalizeKey('Shift+Alt+T'), 'alt+shift+t');

  assert.deepEqual(shortcutKeyParts('Shift+P'), ['Shift', 'P']);
  assert.deepEqual(shortcutKeyParts('t'), ['T']);
  assert.deepEqual(shortcutKeyParts('Space'), ['Space']);
  assert.deepEqual(shortcutKeyParts('esc'), ['Esc']);
  assert.deepEqual(shortcutKeyParts('Enter'), ['Enter']);
  assert.deepEqual(shortcutKeyParts('Ctrl+Space'), ['Ctrl', 'Space']);
  assert.deepEqual(
    shortcutKeyParts('Shift+G 0'),
    ['Shift', 'G', '0'],
    'a chord path splits into one segment per key'
  );
  assert.deepEqual(shortcutKeyParts('C m'), ['C', 'M']);
  assert.deepEqual(
    shortcutKeyParts('⇧D'),
    ['Shift', 'D'],
    'the legacy glyph form still parses'
  );

  assert.equal(LEADER_COMBO, 'Ctrl+Space');
  assert.equal(isLeaderEvent(keyEvent({code: 'Space', ctrlKey: true})), true);
  assert.equal(isLeaderEvent(keyEvent({code: 'Space', metaKey: true})), false);
  assert.equal(isLeaderEvent(keyEvent({code: 'Space'})), false);
  assert.equal(
    isLeaderEvent(keyEvent({code: 'Space', ctrlKey: true, altKey: true})),
    false
  );

  assert.equal(leaderKeyFromEvent(keyEvent({code: 'KeyT'})), 't');
  assert.equal(
    leaderKeyFromEvent(keyEvent({code: 'KeyD', shiftKey: true})),
    'shift+d'
  );
  assert.equal(leaderKeyFromEvent(keyEvent({code: 'Space'})), 'space');
  assert.equal(leaderKeyFromEvent(keyEvent({code: 'Enter'})), 'enter');
  assert.equal(leaderKeyFromEvent(keyEvent({code: 'NumpadEnter'})), 'enter');

  assert.equal(
    leaderKeyFromEvent(keyEvent({code: 'KeyT', ctrlKey: true})),
    null
  );
  assert.equal(
    leaderKeyFromEvent(keyEvent({code: 'KeyT', altKey: true})),
    'alt+t'
  );
  assert.equal(
    leaderKeyFromEvent(keyEvent({code: 'KeyT', altKey: true, shiftKey: true})),
    'alt+shift+t'
  );
  assert.equal(
    leaderKeyFromEvent(keyEvent({code: 'KeyT', altKey: true, metaKey: true})),
    null
  );

  assert.equal(
    leaderKeyFromEvent(keyEvent({code: 'Digit4', key: '$', shiftKey: true})),
    'shift+4'
  );

  assert.equal(chordKeyFromEvent(keyEvent({code: 'Digit0'})), '0');
  assert.equal(chordKeyFromEvent(keyEvent({code: 'KeyA'})), 'a');
  assert.equal(
    chordKeyFromEvent(keyEvent({code: 'KeyA', ctrlKey: true})),
    null
  );

  assert.equal(shortcutLabelAt(0), '0');
  assert.equal(shortcutLabelAt(9), '9');
  assert.equal(shortcutLabelAt(10), 'a');
  assert.equal(shortcutLabelAt(35), 'z');
  assert.equal(shortcutLabelAt(36), '');
  assert.equal(SHORTCUT_LABELS.length, 36);
  assert.equal(new Set(SHORTCUT_LABELS).size, 36, 'labels must be unique');

  assert.equal(buttonKey('readingMode'), 'D');
  assert.equal(COMMAND_SHORTCUTS['/read'], 'D');
  assert.equal(buttonKey('language'), 'L');
  assert.equal(COMMAND_SHORTCUTS['/lang'], 'L');
  assert.equal(COMMAND_SHORTCUTS['/feedback'], 'Shift+D');
  assert.equal(COMMAND_SHORTCUTS['/llms'], 'Shift+L');
  assert.equal(COMMAND_SHORTCUTS['/keyboard'], CATALOG_KEY);

  for (const [id, group] of Object.entries(CHORD_GROUPS)) {
    if (id === 'args') {
      assert.equal(group.combos.length, 0, 'args is armed, never typed');
      continue;
    }
    assert.ok(group.combos.length > 0, `${id} needs a prefix`);
    for (const combo of group.combos) {
      if (group.shadows) {
        assert.equal(
          normalizeKey(combo),
          normalizeKey(COMMAND_SHORTCUTS[group.shadows] ?? ''),
          `${id} may only take a bare key that its shadowed command already owns`
        );
        continue;
      }
      assert.ok(
        normalizeKey(combo).startsWith('shift+'),
        `${id} prefix must be a Shift key`
      );
    }
  }

  for (const [command, key] of Object.entries(COMMAND_SHORTCUTS)) {
    assert.equal(
      /ctrl|cmd|meta|alt/i.test(key),
      false,
      `${command} must be a plain leader key`
    );
  }

  assert.equal(normalizeKey(CATALOG_KEY), 'space');
});

test('text entry targets are recognised across tag, ancestor and contenteditable', () => {
  assert.equal(isTextEntryTarget(null), false);
  assert.equal(isTextEntryTarget(undefined), false);
  assert.equal(isTextEntryTarget({tagName: 'INPUT'}), true);
  assert.equal(isTextEntryTarget({tagName: 'TEXTAREA'}), true);
  assert.equal(isTextEntryTarget({tagName: 'SELECT'}), true);
  assert.equal(isTextEntryTarget({tagName: 'BUTTON'}), false);
  assert.equal(isTextEntryTarget({tagName: 'INPUT', type: 'search'}), true);
  assert.equal(
    isTextEntryTarget({tagName: 'INPUT', type: 'radio'}),
    false,
    'a focused radio must not swallow the next shortcut'
  );
  assert.equal(isTextEntryTarget({tagName: 'INPUT', type: 'checkbox'}), false);
  assert.equal(isTextEntryTarget({tagName: 'INPUT', type: 'range'}), false);
  assert.equal(isTextEntryTarget({isContentEditable: true}), true);
  assert.equal(
    isTextEntryTarget({tagName: 'SPAN', closest: () => ({})}),
    true,
    'a node inside a field counts as a field'
  );
  assert.equal(
    isTextEntryTarget({tagName: 'SPAN', closest: () => null}),
    false
  );
});

test('dispatch stays inert until the leader arms it', () => {
  assert.equal(
    resolveShortcutAction(keyEvent({code: 'KeyT'}), IDLE).kind,
    'ignore',
    'a bare key must reach the page untouched'
  );

  const leader = resolveShortcutAction(
    keyEvent({code: 'Space', ctrlKey: true}),
    IDLE
  );
  assert.equal(leader.kind, 'toggleLeader');
  assert.equal(leader.preventDefault, true);

  assert.equal(
    resolveShortcutAction(keyEvent({code: 'AltLeft', key: 'Alt'}), IDLE).kind,
    'altDown'
  );
});

test('dispatch precedence is catalog, then group, then element, then command', () => {
  assert.equal(
    resolveShortcutAction(keyEvent({code: 'Space'}), ARMED).kind,
    'catalog',
    'the catalog key wins even when an entry claims it'
  );

  const armed = resolveShortcutAction(
    keyEvent({code: 'KeyB', shiftKey: true}),
    {
      ...ARMED,
      hasGroupMembers: () => true,
      hasEntryFor: () => true,
      hasCommandFor: () => true
    }
  );
  assert.equal(armed.kind, 'arm');
  assert.equal(armed.group, 'posts');

  const entry = resolveShortcutAction(keyEvent({code: 'KeyT'}), {
    ...ARMED,
    hasEntryFor: () => true,
    hasCommandFor: () => true
  });
  assert.equal(
    entry.kind,
    'entry',
    'a real button shadows its mirrored command'
  );
  assert.equal(entry.key, 't');

  const command = resolveShortcutAction(keyEvent({code: 'KeyT'}), {
    ...ARMED,
    hasCommandFor: () => true
  });
  assert.equal(command.kind, 'command');
  assert.equal(command.key, 't');
});

test('an empty chord group never arms, so the next key is not swallowed', () => {
  assert.equal(groupForKey('shift+b'), 'posts');
  assert.equal(groupForKey('shift+g'), null);
  assert.equal(groupForKey('shift+p'), null);
  assert.equal(groupForKey('shift+7'), null);

  const miss = resolveShortcutAction(keyEvent({code: 'KeyB', shiftKey: true}), {
    ...ARMED,
    hasGroupMembers: () => false
  });
  assert.equal(miss.kind, 'disarm');
  assert.equal(
    miss.preventDefault,
    false,
    'an unclaimed key must fall through to the browser'
  );
});

test('typing in a field keeps its keystrokes, but the leader and Escape still work', () => {
  const input = {tagName: 'INPUT'};

  const typed = resolveShortcutAction(keyEvent({code: 'KeyT', target: input}), {
    ...ARMED,
    hasEntryFor: () => true
  });
  assert.equal(
    typed.kind,
    'disarm',
    'an armed leader must not eat a character'
  );
  assert.equal(typed.preventDefault, false);

  const chordTyped = resolveShortcutAction(
    keyEvent({code: 'KeyA', target: input}),
    {...ARMED, pendingGroup: 'posts', hasEntryInForm: () => true}
  );
  assert.equal(
    chordTyped.kind,
    'disarm',
    'a pending chord must not eat a character either'
  );
  assert.equal(chordTyped.preventDefault, false);

  assert.equal(
    resolveShortcutAction(
      keyEvent({
        code: 'ShiftLeft',
        key: 'Shift',
        shiftKey: true,
        target: input
      }),
      ARMED
    ).kind,
    'ignore',
    'reaching for Shift must not drop the armed leader'
  );

  const escape = resolveShortcutAction(
    keyEvent({code: 'Escape', key: 'Escape', target: input}),
    ARMED
  );
  assert.equal(escape.kind, 'escape');
  assert.equal(escape.preventDefault, true);

  assert.equal(
    resolveShortcutAction(
      keyEvent({code: 'Space', ctrlKey: true, target: input}),
      IDLE
    ).kind,
    'toggleLeader'
  );
});

test('inside a field, the armed key may submit or clear only its own form', () => {
  const textarea = {tagName: 'TEXTAREA'};

  const submit = resolveShortcutAction(
    keyEvent({code: 'KeyY', shiftKey: true, target: textarea}),
    {...ARMED, hasEntryInForm: key => key === 'shift+y'}
  );
  assert.equal(submit.kind, 'entry');
  assert.equal(submit.inForm, true);
  assert.equal(submit.key, 'shift+y');
  assert.equal(submit.preventDefault, true);

  const elsewhere = resolveShortcutAction(
    keyEvent({code: 'KeyY', shiftKey: true, target: textarea}),
    {...ARMED, hasEntryFor: () => true, hasEntryInForm: () => false}
  );
  assert.equal(
    elsewhere.kind,
    'disarm',
    'a matching button outside this form must not fire while typing'
  );
  assert.equal(elsewhere.preventDefault, false);
});

test('mnemonic groups shadow their command only by claiming the same key', () => {
  assert.equal(groupForKey('c'), 'copy');
  assert.equal(groupForKey('s'), 'save');
  assert.equal(groupForKey('shift+v'), 'view');
  assert.equal(groupForKey('v'), null, 'leader V goes back to /cv');
  assert.equal(groupForKey('e'), 'code');

  const arms = resolveShortcutAction(keyEvent({code: 'KeyC'}), {
    ...ARMED,
    hasGroupMembers: group => group === 'copy',
    hasCommandFor: () => true
  });
  assert.equal(
    arms.kind,
    'arm',
    'on a page with copy targets C opens the layer'
  );
  assert.equal(arms.group, 'copy');

  const falls = resolveShortcutAction(keyEvent({code: 'KeyC'}), {
    ...ARMED,
    hasGroupMembers: () => false,
    hasCommandFor: () => true
  });
  assert.equal(falls.kind, 'command', 'elsewhere C still runs /copy');
});

test('a control in the focused scope outranks a page-level layer on the same key', () => {
  const focused = resolveShortcutAction(keyEvent({code: 'KeyC'}), {
    ...ARMED,
    hasGroupMembers: group => group === 'copy',
    hasScopedEntryFor: key => key === 'c',
    hasEntryFor: () => true
  });
  assert.equal(focused.kind, 'entry', 'C copies the hovered code block');
  assert.equal(focused.key, 'c');

  assert.equal(
    resolveShortcutAction(keyEvent({code: 'KeyC'}), {
      ...ARMED,
      hasGroupMembers: group => group === 'copy',
      hasScopedEntryFor: () => false,
      hasEntryFor: () => true
    }).kind,
    'arm',
    'with nothing focused C still opens the copy layer'
  );
});

test('a pending chord routes to the chord resolver and swallows the key', () => {
  const chord = resolveShortcutAction(keyEvent({code: 'Digit0'}), {
    ...ARMED,
    pendingGroup: 'posts'
  });
  assert.equal(chord.kind, 'chord');
  assert.equal(chord.preventDefault, true);
});

test('a modal scope blocks commands but leaves its own entries reachable', () => {
  const inModal = {...ARMED, modalActive: true, hasCommandFor: () => true};

  const blocked = resolveShortcutAction(keyEvent({code: 'KeyT'}), inModal);
  assert.equal(
    blocked.kind,
    'disarm',
    'a page command must not fire from behind a modal'
  );
  assert.equal(blocked.preventDefault, false);

  const own = resolveShortcutAction(keyEvent({code: 'KeyT'}), {
    ...inModal,
    hasEntryFor: () => true
  });
  assert.equal(own.kind, 'entry', "the modal's own controls still respond");

  assert.equal(
    resolveShortcutAction(keyEvent({code: 'Space'}), inModal).kind,
    'catalog',
    'the catalog stays reachable from inside a modal'
  );
});

test('punctuation keys parse from event.code and survive layout differences', () => {
  assert.equal(leaderKeyFromEvent(keyEvent({code: 'BracketLeft'})), '[');
  assert.equal(leaderKeyFromEvent(keyEvent({code: 'BracketRight'})), ']');
  assert.equal(leaderKeyFromEvent(keyEvent({code: 'Comma'})), ',');
  assert.equal(leaderKeyFromEvent(keyEvent({code: 'Period'})), '.');
  assert.equal(
    leaderKeyFromEvent(keyEvent({code: 'BracketLeft', shiftKey: true})),
    'shift+['
  );
  assert.equal(
    leaderKeyFromEvent(keyEvent({code: 'BracketLeft', ctrlKey: true})),
    null
  );

  assert.deepEqual(shortcutKeyParts('['), ['[']);
  assert.deepEqual(shortcutKeyParts('Shift+]'), ['Shift', ']']);
  assert.equal(normalizeKey('['), '[');

  assert.equal(
    chordKeyFromEvent(keyEvent({code: 'BracketLeft'})),
    null,
    'chord items stay restricted to 0-9 and a-z'
  );
});

test('new button keys are allocated and mirrors point at real commands', () => {
  assert.equal(buttonKey('filterSearch'), 'Shift+Q');
  assert.equal(buttonKey('sortDirection'), 'Shift+T');
  assert.equal(buttonKey('clearFilters'), 'Shift+W');
  assert.equal(buttonKey('pagePrev'), '[');
  assert.equal(buttonKey('pageNext'), ']');
  assert.equal(buttonKey('formClear'), 'Shift+Z');
  assert.equal(buttonKey('formSubmit'), 'Shift+Y');

  for (const [id, button] of Object.entries(BUTTON_SHORTCUTS)) {
    if (!button.mirrors) continue;
    assert.ok(
      COMMAND_SHORTCUTS[button.mirrors],
      `${id} mirrors ${button.mirrors}, which is not a real command`
    );
    assert.equal(
      COMMAND_SHORTCUTS[button.mirrors],
      button.combo,
      `${id} must carry the same key as ${button.mirrors}`
    );
  }
});

test('chord groups are an exact, bounded allow-list', () => {
  assert.deepEqual(Object.keys(CHORD_GROUPS).sort(), [
    'args',
    'code',
    'contact',
    'copy',
    'funding',
    'posts',
    'projects',
    'save',
    'sidebar',
    'social',
    'view'
  ]);
  assert.equal(CHORD_GROUPS.nav, undefined, 'nav items mirror their commands');
  assert.deepEqual(
    Object.values(CHORD_GROUPS)
      .filter(group => group.listed === false)
      .map(group => group.id)
      .sort(),
    ['contact', 'funding', 'posts', 'projects', 'social'],
    'data-driven groups stay out of the catalog'
  );
  assert.equal(buttonKey('tldr'), 'Alt+T');
  assert.equal(
    Object.values(BUTTON_SHORTCUTS).some(button => /^\d$/.test(button.combo)),
    false,
    'no button owns a bare digit'
  );
  assert.equal(groupForKey('shift+g'), null, 'Shift+G stays unassigned');
  assert.equal(findShortcutCollisions().includes('shift+g'), false);
});

test('command layers take their keys from the command arguments', async () => {
  const source = await readFile(
    new URL('../src/lib/components/SpotlightSearch.svelte', import.meta.url),
    'utf8'
  );
  for (const [command, args] of Object.entries(COMMAND_ARG_KEYS)) {
    const block = source.match(
      new RegExp(`command: '${command}',[\\s\\S]*?validArgs: \\[([^\\]]*)\\]`)
    );
    assert.ok(block, `${command} must declare validArgs`);
    const validArgs = [...block[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
    for (const arg of Object.keys(args)) {
      assert.ok(
        validArgs.includes(arg),
        `${command} ${arg} must be a real argument`
      );
    }
    const group = Object.values(CHORD_GROUPS).find(g => g.shadows === command);
    assert.ok(group, `${command} must have a layer`);
    assert.equal(
      normalizeKey(group.combos[0]),
      normalizeKey(COMMAND_SHORTCUTS[command])
    );
  }
  assert.equal(argKey('/save', 'cv'), 'C');
  assert.equal(argKey('/copy', 'pid'), 'P');
  assert.equal(argKey('/code', 'wrap'), 'W');
});

test('section links resolve to their slash command key', () => {
  assert.equal(sectionCommandKey('home'), 'H');
  assert.equal(sectionCommandKey('/'), 'H');
  assert.equal(sectionCommandKey('/#blog'), 'B');
  assert.equal(sectionCommandKey('/#projects'), 'J');
  assert.equal(sectionCommandKey('cv'), 'V');
  assert.equal(sectionCommandKey('/#unknown'), '');
});

test('platform detection reads UA-CH, legacy platform and user agent', () => {
  assert.equal(detectPlatform({userAgentData: {platform: 'macOS'}}), 'mac');
  assert.equal(detectPlatform({platform: 'MacIntel'}), 'mac');
  assert.equal(
    detectPlatform({
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'
    }),
    'mac'
  );
  assert.equal(detectPlatform({platform: 'Win32'}), 'windows');
  assert.equal(detectPlatform({platform: 'Linux x86_64'}), 'linux');
  assert.equal(detectPlatform({}), 'other');
  assert.equal(detectPlatform(undefined), 'other');
});

test('keys render as Mac glyphs or keycap words', () => {
  assert.equal(keyLabel('Mod', 'mac').text, '⌘');
  assert.equal(keyLabel('Mod', 'windows').text, 'Ctrl');
  assert.equal(keyLabel('Ctrl', 'mac').text, '⌃', 'Control is not Command');
  assert.equal(keyLabel('Ctrl', 'mac').icon, 'ChevronUp');
  assert.equal(keyLabel('Alt', 'mac').icon, 'Option');
  assert.equal(keyLabel('Alt', 'linux').text, 'Alt');
  assert.equal(keyLabel('Shift', 'mac').icon, 'ArrowBigUp');
  assert.equal(keyLabel('Shift', 'windows').text, 'Shift');
  assert.equal(keyLabel('Meta', 'windows').text, 'Win');
  assert.equal(keyLabel('Meta', 'linux').text, 'Super');
  assert.equal(keyLabel('Enter', 'mac').icon, 'CornerDownLeft');
  assert.equal(keyLabel('Tab', 'mac').icon, 'ArrowRightToLine');
  assert.equal(keyLabel('CapsLock', 'mac').icon, 'ArrowBigUpDash');
  assert.equal(keyLabel('CapsLock', 'windows').text, 'Caps Lock');
  assert.equal(keyLabel('PageDown', 'windows').text, 'PgDn');
  assert.equal(keyLabel('K', 'mac').text, 'K');

  assert.deepEqual(shortcutKeyParts('Mod+Shift+K', 'mac'), [
    'Shift',
    'Mod',
    'K'
  ]);
  assert.deepEqual(shortcutKeyParts('Shift+Mod+K', 'windows'), [
    'Mod',
    'Shift',
    'K'
  ]);
  assert.equal(shortcutText('Mod+Shift+K', 'mac'), '⇧ ⌘ K');
  assert.equal(shortcutText('Mod+Shift+K', 'windows'), 'Ctrl+Shift+K');
  assert.equal(shortcutText(LEADER_COMBO, 'mac'), '⌃ Space');
});

test('the leader and its fallback are physical Control on every platform', () => {
  assert.equal(LEADER_FALLBACK_COMBO, 'Ctrl+Shift+Space');
  assert.equal(
    isLeaderEvent(keyEvent({code: 'Space', ctrlKey: true, shiftKey: true})),
    true
  );
  assert.equal(isLeaderEvent(keyEvent({code: 'Space', metaKey: true})), false);
  assert.equal(isLeaderEvent(keyEvent({code: 'Space', altKey: true})), false);
});

test('every catalog command has a human label', () => {
  const missing = Object.keys(COMMAND_SHORTCUTS).filter(
    command => command !== '/keyboard' && !COMMAND_LABELS[command]
  );
  assert.deepEqual(missing, []);
});
