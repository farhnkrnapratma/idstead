import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {
  findShortcutCollisions,
  normalizeKey,
  displayKey,
  isLeaderEvent,
  leaderKeyFromEvent,
  chordKeyFromEvent,
  shortcutLabelAt,
  buttonKey,
  SHORTCUT_LABELS,
  LEADER_COMBO,
  CATALOG_KEY,
  CHORD_GROUPS,
  COMMAND_SHORTCUTS
} from '../src/lib/shortcuts';

function keyEvent(init: {
  code: string;
  key?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}) {
  return init as unknown as KeyboardEvent;
}

test('shortcut keys preserve browser modifiers, chord assignments and collision checks', () => {
  assert.deepEqual(
    findShortcutCollisions(),
    [],
    'every leader-level key must be unique'
  );

  assert.equal(normalizeKey('Shift+D'), 'shift+d');
  assert.equal(normalizeKey(' t '), 't');
  assert.equal(normalizeKey('Esc'), 'esc');

  assert.equal(displayKey('Shift+P'), '⇧P');
  assert.equal(displayKey('T'), 'T');
  assert.equal(displayKey('Space'), 'Space');
  assert.equal(displayKey('Esc'), 'Esc');

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

  assert.equal(
    leaderKeyFromEvent(keyEvent({code: 'KeyT', ctrlKey: true})),
    null
  );
  assert.equal(
    leaderKeyFromEvent(keyEvent({code: 'KeyT', altKey: true})),
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

  assert.equal(CHORD_GROUPS.toc, undefined);

  for (const [id, group] of Object.entries(CHORD_GROUPS)) {
    if (id === 'args') {
      assert.equal(group.combos.length, 0, 'args is armed, never typed');
      continue;
    }
    assert.ok(group.combos.length > 0, `${id} needs a prefix`);
    for (const combo of group.combos) {
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
