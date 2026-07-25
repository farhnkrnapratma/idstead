<!-- @format -->
<script lang="ts">
  import {cn} from '../../utils/cn'
  import type {Snippet} from 'svelte'

  interface Props {
    ariaLabel: string
    isOpen?: boolean
    children: Snippet
    onclick?: () => void
  }

  let {ariaLabel, isOpen = false, children, onclick}: Props = $props()
</script>

<button
  type="button"
  {onclick}
  aria-label={ariaLabel}
  aria-expanded={isOpen}
  aria-haspopup="listbox"
  class={cn(
    'inline-flex h-8 min-w-22 cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-border-subtle bg-surface-card px-2.5 text-xs font-medium text-text-primary shadow-2xs',
    'transition-all hover:border-border-subtle/80 hover:bg-surface-hover',
    'focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none',
    isOpen && 'border-border-subtle/60 bg-surface-hover'
  )}>
  <span class="truncate leading-none">{@render children()}</span>
  <span
    class="inline-flex h-4 w-4 shrink-0 origin-center items-center justify-center text-text-muted transition-transform duration-200 ease-out {(
      isOpen
    ) ?
      'rotate-180'
    : ''}">
    <i class="bi bi-chevron-down text-[10px] leading-none" aria-hidden="true"
    ></i>
  </span>
</button>
