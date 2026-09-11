<script lang="ts">
  import {SvelteMap} from 'svelte/reactivity';
  import Dialog from './Dialog.svelte';
  import EmptyState from './EmptyState.svelte';
  import ShortcutBadge from './ShortcutBadge.svelte';
  import {shortcutStore} from '../stores/shortcutStore.svelte';
  import {
    CHORD_GROUPS,
    LEADER_COMBO,
    CATALOG_KEY,
    COMMAND_SHORTCUTS,
    displayKey
  } from '$lib/shortcuts';

  const commandRows = Object.entries(COMMAND_SHORTCUTS).map(
    ([command, combo]) => ({command, combo: displayKey(combo)})
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

{#snippet row(label: string, badge: string, mono = false)}
  <div
    class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-surface-hover">
    <span
      class="min-w-0 truncate text-xs text-text-primary {mono ? 'font-mono' : (
        ''
      )}">
      {label}
    </span>
    <ShortcutBadge combo={badge} />
  </div>
{/snippet}

<Dialog
  isOpen={shortcutStore.catalogOpen}
  title="Keyboard Shortcuts"
  description="Press Ctrl+Space and let go, then press one key. Hold Alt at any time to peek at the badges without arming anything."
  size="lg"
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
          <ShortcutBadge
            combo={LEADER_COMBO}
            icon />
        </div>
        {@render row('Open this catalog', displayKey(CATALOG_KEY))}
        {@render row('Leave shortcut mode', 'Esc')}
      </section>

      {#if directEntries.length > 0}
        <section class="flex flex-col gap-1.5">
          <h3
            class="text-2xs font-bold tracking-wider text-text-secondary uppercase">
            Actions
          </h3>
          {#each directEntries as entry (entry.id)}
            {@render row(entry.label, displayKey(entry.combos[0]))}
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
          {#if group.spec && group.spec.combos.length > 0}
            <p class="px-2 text-3xs text-text-muted">
              Press {group.spec.combos.map(displayKey).join(' or ')}, then the
              key shown below.
            </p>
          {/if}
          {#each group.rows as entry (entry.id)}
            {@render row(entry.label, entry.chordKey ?? '')}
          {/each}
        </section>
      {/each}
    </div>
  {/if}
</Dialog>
