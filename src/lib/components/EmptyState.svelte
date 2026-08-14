<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'
  import {cn} from '../utils/cn'

  interface Props {
    title: string
    description?: string
    icon?: string
    class?: string
    actions?: Snippet
  }

  let {
    title,
    description = '',
    icon = 'bi-inbox',
    class: className = '',
    actions
  }: Props = $props()
</script>

<div
  class={cn(
    'flex flex-col items-center justify-center rounded-sm border border-dashed border-border-default bg-surface/30 p-8 text-center select-none',
    className
  )}>
  <div class="mb-3 flex items-center justify-center text-text-muted">
    <i
      class="bi {icon} text-2xl"
      aria-hidden="true"></i>
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
