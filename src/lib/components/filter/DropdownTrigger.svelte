<!-- @format -->
<script lang="ts">
  import {cn} from '../../utils/cn'
  import type {Snippet} from 'svelte'

  interface Props {
    ariaLabel: string
    isOpen?: boolean
    disabled?: boolean
    fullWidth?: boolean
    variant?: 'secondary' | 'primary'
    class?: string
    options?: Array<{label: string}>
    children: Snippet
    onclick?: () => void
  }

  let {
    ariaLabel,
    isOpen = false,
    disabled = false,
    fullWidth = false,
    variant = 'secondary',
    class: className = '',
    options = [],
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
    'inline-flex cursor-pointer items-center justify-between gap-1.5 rounded-sm border font-medium disabled:cursor-not-allowed disabled:opacity-50',
    fullWidth ? 'w-full' : 'min-w-22',
    variant === 'primary' ?
      cn(
        'h-10 border-copilot/50 bg-copilot px-3 text-xs text-white shadow-lg sm:px-4 sm:text-sm',
        !disabled && 'transition-all hover:brightness-110'
      )
    : cn(
        'h-9 glass-card px-3 text-xs text-text-primary shadow-2xs',
        !disabled && 'hover:text-copilot',
        isOpen && 'border-copilot/60 bg-surface-card/70 text-copilot'
      ),
    'focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none',
    className
  )}>
  {#if options && options.length > 0}
    <span class="grid grid-cols-1 grid-rows-1 items-center overflow-hidden">
      {#each options as opt (opt.label)}
        <span
          class="pointer-events-none invisible col-start-1 row-start-1 inline-flex items-center gap-1.5 truncate leading-none"
          aria-hidden="true">
          {opt.label}
        </span>
      {/each}
      <span
        class="col-start-1 row-start-1 inline-flex items-center gap-1.5 truncate leading-none">
        {@render children()}
      </span>
    </span>
  {:else}
    <span class="inline-flex items-center gap-1.5 truncate leading-none">
      {@render children()}
    </span>
  {/if}
  <span
    class="h-4 w-4 shrink-0 origin-center items-center justify-center transition-transform duration-200 ease-out {(
      variant === 'primary'
    ) ?
      'hidden sm:inline-flex'
    : 'inline-flex'} {variant === 'primary' ? 'text-white/80' : (
      'text-text-muted'
    )} {isOpen ? 'rotate-180' : ''}">
    <i
      class="bi bi-chevron-down text-2xs leading-none"
      aria-hidden="true"></i>
  </span>
</button>
