<script lang="ts">
  import {SvelteMap} from 'svelte/reactivity';
  import Dialog from './Dialog.svelte';
  import EmptyState from './EmptyState.svelte';
  import ShortcutBadge from './ShortcutBadge.svelte';
  import {shortcutStore} from '../stores/shortcutStore.svelte';
  import {
    CHORD_GROUPS,
    LEADER_COMBO,
    LEADER_FALLBACK_COMBO,
    CATALOG_KEY,
    COMMAND_SHORTCUTS,
    shortcutText,
    keyLabel
  } from '$lib/shortcuts';
  import {platformStore} from '../stores/platformStore.svelte';

  const description = $derived(
    `Press ${shortcutText(LEADER_COMBO, platformStore.current)} and let go, then press one key. Hold ${keyLabel('Alt', platformStore.current).name} at any time to peek at the badges without arming anything.`
  );

  const commandRows = Object.entries(COMMAND_SHORTCUTS).map(
    ([command, combo]) => ({command, combo})
  );

  const entries = $derived(
    shortcutStore.catalogOpen ? shortcutStore.catalogEntries() : []
  );

  const directEntries = $derived(
    entries.filter(entry => !entry.group && entry.combos.length > 0)
  );

  const groupedEntries = $derived.by(() => {
    const byGroup = new SvelteMap<string, typeof entries>();
    for (const entry of entries) {
      if (!entry.group) continue;
      const bucket = byGroup.get(entry.group);
      if (bucket) bucket.push(entry);
      else byGroup.set(entry.group, [entry]);
    }
    return [...byGroup.entries()].map(([groupId, rows]) => ({
      groupId,
      spec: CHORD_GROUPS[groupId],
      rows
    }));
  });

  const hasAny = $derived(
    directEntries.length > 0
      || groupedEntries.length > 0
      || commandRows.length > 0
  );
</script>

{#snippet row(label: string, badge: string, mono = false, leader = true)}
  <div
    class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-surface-hover">
    <span
      class="min-w-0 truncate text-xs text-text-primary {mono ? 'font-mono' : (
        ''
      )}">
      {label}
    </span>
    <ShortcutBadge
      combo={badge}
      {leader} />
  </div>
{/snippet}

<Dialog
  isOpen={shortcutStore.catalogOpen}
  title="Keyboard shortcuts"
  {description}
  size="lg"
  trapShortcuts={false}
  onClose={() => (shortcutStore.catalogOpen = false)}>
  {#if !hasAny}
    <EmptyState
      title="No shortcuts here"
      description="This page has no registered shortcuts yet." />
  {:else}
    <div class="flex flex-col gap-5">
      <section class="flex flex-col gap-1.5">
        <h3
          class="text-2xs font-bold tracking-wider text-text-secondary uppercase">
          Global
        </h3>
        <div
          class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-surface-hover">
          <span class="min-w-0 text-xs text-text-primary">
            Enter shortcut mode
          </span>
          <ShortcutBadge combo={LEADER_COMBO} />
        </div>
        <div
          class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-surface-hover">
          <span class="min-w-0 text-xs text-text-primary">
            Enter shortcut mode, if your input method owns the first
          </span>
          <ShortcutBadge combo={LEADER_FALLBACK_COMBO} />
        </div>
        {@render row('Open this catalog', CATALOG_KEY)}
        {@render row('Leave shortcut mode', 'Esc', false, false)}
        <p class="px-2 text-3xs leading-relaxed text-text-muted">
          Shortcut mode ends on its own after 5 seconds. It stays out of the way
          while you type in a text field, and while a dialog is open only that
          dialog's own shortcuts respond. This catalog is the exception, so you
          can press a key straight from here.
        </p>
      </section>

      {#if directEntries.length > 0}
        <section class="flex flex-col gap-1.5">
          <h3
            class="text-2xs font-bold tracking-wider text-text-secondary uppercase">
            Actions
          </h3>
          {#each directEntries as entry (entry.id)}
            {@render row(entry.label, entry.combos[0])}
          {/each}
        </section>
      {/if}

      <section class="flex flex-col gap-1.5">
        <h3
          class="text-2xs font-bold tracking-wider text-text-secondary uppercase">
          Commands
        </h3>
        <div class="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
          {#each commandRows as command (command.command)}
            {@render row(command.command, command.combo, true)}
          {/each}
        </div>
      </section>

      {#each groupedEntries as group (group.groupId)}
        <section class="flex flex-col gap-1.5">
          <h3
            class="text-2xs font-bold tracking-wider text-text-secondary uppercase">
            {group.spec?.label ?? group.groupId}
          </h3>
          {#each group.rows as entry (entry.id)}
            {@render row(
              entry.label,
              `${group.spec?.combos[0] ?? ''} ${entry.chordKey ?? ''}`
            )}
          {/each}
        </section>
      {/each}
    </div>
  {/if}
</Dialog>
