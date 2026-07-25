<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'
  import {cn} from '../utils/cn'

  interface Props {
    title?: string
    description?: string
    action?: string
    method?: 'POST' | 'GET' | 'post' | 'get' | 'dialog' | 'DIALOG'
    onsubmit?: (e: SubmitEvent) => void
    class?: string
    children?: Snippet
    actions?: Snippet
  }

  let {
    title = '',
    description = '',
    action = '',
    method = 'POST',
    onsubmit,
    class: className = '',
    children,
    actions
  }: Props = $props()
</script>

<form
  {action}
  {method}
  {onsubmit}
  novalidate
  class={cn(
    'flex w-full flex-col gap-4 rounded-2xl border border-border-subtle bg-surface/60 p-5 shadow-xs backdrop-blur-lg transition-colors duration-300 sm:p-6',
    className
  )}
  autocomplete="off"
>
  {#if title || description}
    <div class="mb-1 select-none">
      {#if title}
        <h2 class="text-sm font-bold text-text-primary">{title}</h2>
      {/if}
      {#if description}
        <p class="mt-0.5 text-xs text-text-muted">{description}</p>
      {/if}
    </div>
  {/if}

  {@render children?.()}

  {#if actions}
    <div class="mt-3 flex justify-end">
      {@render actions()}
    </div>
  {/if}
</form>
