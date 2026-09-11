<script lang="ts">
  import type {Snippet} from 'svelte';
  import {Inbox} from '@lucide/svelte';
  import {cn} from '../utils/cn';

  interface Props {
    title: string;
    description?: string;
    class?: string;
    icon?: Snippet;
    actions?: Snippet;
  }

  let {
    title,
    description = '',
    class: className = '',
    icon,
    actions
  }: Props = $props();
</script>

<div
  class={cn(
    'flex flex-col items-center justify-center rounded-md border border-dashed border-border-default bg-surface/30 p-8 text-center select-none',
    className
  )}>
  <div class="mb-3 flex items-center justify-center text-text-muted">
    {#if icon}
      {@render icon()}
    {:else}
      <Inbox class="size-7" />
    {/if}
  </div>
  <h3 class="text-sm font-bold text-text-primary">{title}</h3>
  {#if description}
    <p class="mt-1 max-w-xs text-xs text-text-muted">{description}</p>
  {/if}

  {#if actions}
    <div class="mt-4 flex items-center gap-2">
      {@render actions()}
    </div>
  {/if}
</div>
