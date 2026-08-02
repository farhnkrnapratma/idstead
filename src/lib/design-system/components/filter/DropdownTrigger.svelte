<!-- @format -->
<script lang="ts">
  import {cn} from '../../utils/cn'
  import type {Snippet} from 'svelte'

  interface Props {
    ariaLabel: string
    isOpen?: boolean
    disabled?: boolean
    fullWidth?: boolean
    children: Snippet
    onclick?: () => void
  }

  let {
    ariaLabel,
    isOpen = false,
    disabled = false,
    fullWidth = false,
    children,
    onclick
  }: Props = $props()
</script>

<button
  type="button"
  {onclick}
  {disabled}
  aria-label={ariaLabel}
  aria-expanded={isOpen}
  aria-haspopup="listbox"
  class={cn(
    'inline-flex h-9 cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-border-subtle bg-surface-card px-3 text-xs font-medium text-text-primary shadow-2xs disabled:cursor-not-allowed disabled:opacity-50',
    fullWidth ? 'w-full' : 'min-w-22',
    !disabled
      && 'transition-all hover:border-copilot/50 hover:bg-surface-hover hover:text-copilot',
    'focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none',
    isOpen && 'border-copilot/60 bg-surface-hover text-copilot'
  )}>
  <span class="truncate leading-none">{@render children()}</span>
  <span
    class="inline-flex h-4 w-4 shrink-0 origin-center items-center justify-center text-text-muted transition-transform duration-200 ease-out {(
      isOpen
    ) ?
      'rotate-180'
    : ''}">
    <i
      class="bi bi-chevron-down text-[10px] leading-none"
      aria-hidden="true"></i>
  </span>
</button>
