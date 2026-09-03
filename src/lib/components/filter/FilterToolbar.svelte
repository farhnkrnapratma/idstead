<script lang="ts">
  import type {Snippet} from 'svelte';
  import {cn} from '../../utils/cn';

  interface Props {
    title?: string;
    searchSlot?: Snippet;
    filterControlsSlot?: Snippet;
    sortSlot?: Snippet;
    chipsSlot?: Snippet;
    countSlot?: Snippet;
    class?: string;
  }

  let {
    title = '',
    searchSlot,
    filterControlsSlot,
    sortSlot,
    chipsSlot,
    countSlot,
    class: className = ''
  }: Props = $props();
</script>

<div
  role="region"
  aria-label={title || 'Filter and sort options'}
  class={cn(
    'relative z-20 flex flex-col gap-3 rounded-sm glass-card p-4 select-none',
    className
  )}>
  <div
    class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <div class="w-full sm:w-72 sm:max-w-xs">
      {#if searchSlot}
        {@render searchSlot()}
      {/if}
    </div>

    {#if countSlot}
      <div class="flex items-center sm:justify-end">
        {@render countSlot()}
      </div>
    {/if}
  </div>

  <div
    class="flex flex-col gap-2.5 border-t border-border-subtle/40 pt-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
    <div class="w-full sm:w-auto">
      {#if filterControlsSlot}
        {@render filterControlsSlot()}
      {/if}
    </div>

    {#if sortSlot}
      <div class="w-full sm:flex sm:w-auto sm:items-center sm:justify-end">
        {@render sortSlot()}
      </div>
    {/if}
  </div>

  {#if chipsSlot}
    {@render chipsSlot()}
  {/if}
</div>
