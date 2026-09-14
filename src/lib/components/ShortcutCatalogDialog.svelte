<script lang="ts">
  import Dialog from './Dialog.svelte';
  import ShortcutBadge from './ShortcutBadge.svelte';
  import {shortcutStore} from '../stores/shortcutStore.svelte';
  import {
    CHORD_GROUPS,
    LEADER_COMBO,
    LEADER_FALLBACK_COMBO,
    CATALOG_KEY,
    COMMAND_SHORTCUTS,
    COMMAND_LABELS,
    normalizeKey
  } from '$lib/shortcuts';

  const commandRows = Object.entries(COMMAND_SHORTCUTS)
    .filter(([command]) => COMMAND_LABELS[command])
    .map(([command, combo]) => ({
      id: command,
      label: `${COMMAND_LABELS[command]} or ${command}`,
      combo
    }));

  const commandKeys = new Set(
    Object.values(COMMAND_SHORTCUTS).map(normalizeKey)
  );

  const entries = $derived(
    shortcutStore.catalogOpen ? shortcutStore.catalogEntries() : []
  );

  const actionRows = $derived.by(() => {
    const keyOf = (entry: (typeof entries)[number]) =>
      `${entry.scope}|${normalizeKey(entry.combos[0] ?? '')}`;
    return entries.flatMap((entry, index) => {
      if (!entry.group) {
        const combo = entry.combos[0];
        if (
          !combo
          || commandKeys.has(normalizeKey(combo))
          || entries.findIndex(
            other => !other.group && keyOf(other) === keyOf(entry)
          ) !== index
        )
          return [];
        return [{id: entry.id, label: entry.label, combo}];
      }
      const spec = CHORD_GROUPS[entry.group];
      if (!spec || spec.listed === false || !spec.combos[0]) return [];
      return [
        {
          id: entry.id,
          label: entry.label,
          combo: `${spec.combos[0]} ${entry.chordKey ?? ''}`
        }
      ];
    });
  });
</script>

{#snippet row(label: string, badge: string)}
  <div
    class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-surface-hover">
    <span class="min-w-0 truncate text-xs text-text-primary">{label}</span>
    <ShortcutBadge
      combo={badge}
      leader />
  </div>
{/snippet}

<Dialog
  isOpen={shortcutStore.catalogOpen}
  title="Keyboard shortcuts"
  description="Get around without the mouse."
  size="lg"
  trapShortcuts={false}
  onClose={() => (shortcutStore.catalogOpen = false)}>
  <div class="flex flex-col gap-3">
    <div class="flex flex-col gap-0.5">
      <div
        class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-surface-hover">
        <span class="min-w-0 truncate text-xs text-text-primary"
          >Toggle shortcut mode</span>
        <span
          class="flex shrink-0 items-center gap-1.5 text-xs text-text-muted">
          <ShortcutBadge combo={LEADER_COMBO} />
          /
          <ShortcutBadge combo={LEADER_FALLBACK_COMBO} />
        </span>
      </div>
      {@render row('Open this list', CATALOG_KEY)}
    </div>

    <hr class="border-border-subtle" />

    <div class="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
      {#each actionRows as action (action.id)}
        {@render row(action.label, action.combo)}
      {/each}
      {#each commandRows as command (command.id)}
        {@render row(command.label, command.combo)}
      {/each}
    </div>
  </div>
</Dialog>
