<script lang="ts">
  import type {Snippet} from 'svelte'
  import {cn} from '../../utils/cn'

  interface Props {
    title?: string
    searchSlot?: Snippet
    filterControlsSlot?: Snippet
    sortSlot?: Snippet
    chipsSlot?: Snippet
    countSlot?: Snippet
    class?: string
  }

  let {
    title = '',
    searchSlot,
    filterControlsSlot,
    sortSlot,
    chipsSlot,
    countSlot,
    class: className = ''
  }: Props = $props()
</script>

<div
  role="region"
  aria-label={title || 'Filter and sort options'}
  class={cn(
    'relative z-30 flex flex-col gap-3 rounded-sm glass-card p-4 select-none',
    className
  )}>
  <div
    class="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
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
    class="flex flex-col gap-3 border-t border-border-subtle/40 pt-2.5 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex flex-wrap items-center gap-3">
      {#if filterControlsSlot}
        {@render filterControlsSlot()}
      {/if}
    </div>

    <div class="flex items-center sm:justify-end">
      {#if sortSlot}
        {@render sortSlot()}
      {/if}
    </div>
  </div>

  {#if chipsSlot}
    {@render chipsSlot()}
  {/if}
</div>
