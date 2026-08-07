<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'
  import {cn} from '../utils/cn'

  interface Props {
    title?: string
    description?: string
    titleClass?: string
    action?: string
    method?: 'POST' | 'GET' | 'post' | 'get' | 'dialog' | 'DIALOG'
    onsubmit?: (e: SubmitEvent) => void
    class?: string
    children?: Snippet
    headerActions?: Snippet
    actions?: Snippet
  }

  let {
    title = '',
    description = '',
    titleClass = 'text-xl font-bold text-text-primary',
    action = '',
    method = 'POST',
    onsubmit,
    class: className = '',
    children,
    headerActions,
    actions
  }: Props = $props()
</script>

<form
  {action}
  {method}
  {onsubmit}
  novalidate
  class={cn(
    'flex flex-col gap-6 rounded-sm border border-border-subtle bg-surface-card p-6 shadow-xs',
    className
  )}
  autocomplete="off">
  {#if title || description || headerActions}
    <div class="flex items-center justify-between gap-4">
      <div class="select-none">
        {#if title}
          <h2 class={titleClass}>{title}</h2>
        {/if}
        {#if description}
          <p class="mt-1 text-xs text-text-secondary">{description}</p>
        {/if}
      </div>
      {#if headerActions}
        {@render headerActions()}
      {/if}
    </div>
  {/if}

  {@render children?.()}

  {@render actions?.()}
</form>
