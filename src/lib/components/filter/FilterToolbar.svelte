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
    embedded?: boolean;
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
    embedded = false,
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
    },
    get stackOnMobile() {
      return true;
    }
  });
</script>

<div
  role="region"
  aria-label={title || 'Filter and sort options'}
  class={cn(
    'relative z-20 flex flex-col gap-2.5 select-none',
    embedded ?
      'border-b border-border-subtle px-4 pb-3'
    : 'rounded-md glass-card p-3 sm:p-4',
    className
  )}>
  <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
