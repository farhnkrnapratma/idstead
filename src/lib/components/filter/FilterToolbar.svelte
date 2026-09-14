<script lang="ts">
  import {setContext, type Snippet} from 'svelte';
  import {cn} from '../../utils/cn';
  import {
    FILTER_TOOLBAR_CONTROL_SIZE,
    type FilterToolbarControlSize
  } from './filterToolbarContext';

  interface Props {
    title?: string;
    controlSize?: FilterToolbarControlSize;
    searchSlot?: Snippet;
    filterControlsSlot?: Snippet;
    sortSlot?: Snippet;
    chipsSlot?: Snippet;
    countSlot?: Snippet;
    class?: string;
  }

  let {
    title = '',
    controlSize = 'md',
    searchSlot,
    filterControlsSlot,
    sortSlot,
    chipsSlot,
    countSlot,
    class: className = ''
  }: Props = $props();

  setContext(FILTER_TOOLBAR_CONTROL_SIZE, {
    get controlSize() {
      return controlSize;
    }
  });
</script>

<div
  role="region"
  aria-label={title || 'Filter and sort options'}
  class={cn(
    'relative z-20 flex flex-col gap-2.5 rounded-md glass-card p-3 select-none sm:p-4',
    className
  )}>
  <div class="flex flex-wrap items-center gap-2">
    {#if searchSlot}
      <div class="min-w-48 flex-1">
        {@render searchSlot()}
      </div>
    {/if}
    {#if filterControlsSlot}
      {@render filterControlsSlot()}
    {/if}
    {#if sortSlot}
      {@render sortSlot()}
    {/if}
  </div>

  {#if countSlot}
    {@render countSlot()}
  {/if}

  {#if chipsSlot}
    {@render chipsSlot()}
  {/if}
</div>
