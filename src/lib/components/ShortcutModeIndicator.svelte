<script lang="ts">
  import {fade} from 'svelte/transition';
  import {CHORD_GROUPS} from '$lib/shortcuts';
  import {shortcutStore} from '../stores/shortcutStore.svelte';

  const pendingLabel = $derived(
    shortcutStore.pendingGroup ?
      (CHORD_GROUPS[shortcutStore.pendingGroup]?.label
        ?? shortcutStore.pendingGroup)
    : ''
  );
</script>

{#if shortcutStore.leaderArmed}
  <div
    transition:fade={{duration: 120}}
    aria-live="polite"
    class="pointer-events-none fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-200 flex -translate-x-1/2 items-center gap-2 rounded-full glass-overlay border border-accent/40 px-3 py-1.5 font-sans text-2xs font-medium text-text-primary shadow-lg">
    <span class="size-1.5 shrink-0 animate-pulse rounded-full bg-accent"></span>
    {#if pendingLabel}
      <span>{pendingLabel} — press the key shown</span>
    {:else}
      <span>Shortcut mode — press a key</span>
    {/if}
    <kbd
      class="rounded border border-border-subtle/70 px-1 font-mono text-3xs text-text-muted">
      Esc
    </kbd>
  </div>
{/if}
