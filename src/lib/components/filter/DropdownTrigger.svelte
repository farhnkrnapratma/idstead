<script lang="ts">
  import type {Snippet} from 'svelte';
  import {ChevronDown} from '@lucide/svelte';
  import {cn} from '../../utils/cn';

  interface Props {
    ariaLabel: string;
    isOpen?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    size?: 'sm' | 'md';
    variant?: 'secondary' | 'primary';
    class?: string;
    options?: Array<{label: string}>;
    children: Snippet;
    onclick?: () => void;
  }

  let {
    ariaLabel,
    isOpen = false,
    disabled = false,
    fullWidth = false,
    size = 'md',
    variant = 'secondary',
    class: className = '',
    options = [],
    children,
    onclick
  }: Props = $props();
</script>

<button
  type="button"
  {onclick}
  {disabled}
  aria-label={ariaLabel}
  aria-expanded={isOpen}
  aria-haspopup="listbox"
  class={cn(
    'inline-flex cursor-pointer items-center justify-between gap-1 rounded-sm border font-medium disabled:cursor-not-allowed disabled:opacity-50',
    fullWidth ? 'w-full'
    : size === 'sm' ? 'min-w-0'
    : 'min-w-22',
    variant === 'primary' ?
      cn(
        size === 'sm' ?
          'h-7 border-copilot/50 bg-copilot px-2 text-2xs text-white shadow-xs'
        : 'h-10 border-copilot/50 bg-copilot px-3 text-xs text-white shadow-lg sm:px-4 sm:text-sm',
        !disabled && 'transition-all hover:brightness-110'
      )
    : cn(
        size === 'sm' ?
          'h-7 glass-card px-2 text-2xs text-text-primary shadow-2xs'
        : 'h-9 glass-card px-3 text-xs text-text-primary shadow-2xs',
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
    class="shrink-0 origin-center items-center justify-center transition-transform duration-200 ease-out {(
      size === 'sm'
    ) ?
      'size-3'
    : 'size-4'} {variant === 'primary' ?
      'hidden text-white/80 sm:inline-flex'
    : 'inline-flex text-text-muted'} {isOpen ? 'rotate-180' : ''}">
    <ChevronDown class="{size === 'sm' ? 'size-2.5' : 'size-3'} leading-none" />
  </span>
</button>
