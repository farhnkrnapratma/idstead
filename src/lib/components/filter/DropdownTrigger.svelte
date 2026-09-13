<script lang="ts">
  import type {Snippet} from 'svelte';
  import {ChevronDown} from '@lucide/svelte';
  import {cn} from '../../utils/cn';

  interface Props {
    ariaLabel: string;
    labelPrefix?: string;
    isOpen?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    size?: 'sm' | 'md';
    variant?: 'secondary' | 'primary';
    class?: string;
    options?: Array<{label: string; shortLabel?: string}>;
    children: Snippet;
    hideChevron?: boolean;
    onclick?: () => void;
  }

  let {
    ariaLabel,
    labelPrefix,
    isOpen = false,
    disabled = false,
    fullWidth = false,
    size = 'md',
    variant = 'secondary',
    class: className = '',
    options = [],
    children,
    hideChevron = false,
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
    'inline-flex cursor-pointer items-center justify-between gap-1 rounded-md font-medium disabled:cursor-not-allowed disabled:opacity-50',
    fullWidth ? 'w-full' : 'w-auto',
    variant === 'primary' ?
      cn(
        size === 'sm' ?
          'h-8 border border-accent/50 bg-accent px-2 text-xs text-white shadow-xs'
        : 'h-10 border border-accent/50 bg-accent px-3 text-xs text-white shadow-lg sm:px-4 sm:text-sm',
        !disabled && 'transition-all hover:brightness-110'
      )
    : cn(
        'glass-button',
        size === 'sm' ? 'h-8 px-2 text-xs' : 'h-9 px-3 text-xs',
        !disabled && 'hover:text-accent',
        isOpen && 'border-accent/60 bg-surface-card text-accent'
      ),
    'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
    className
  )}>
  {#if options && options.length > 0}
    <span class="grid min-w-0 grid-cols-1 grid-rows-1 items-center">
      {#each options as opt (opt.label)}
        <span
          class="pointer-events-none invisible col-start-1 row-start-1 inline-flex items-center gap-1 leading-none whitespace-nowrap"
          aria-hidden="true">
          {#if labelPrefix}
            <span class="font-normal text-text-muted">{labelPrefix}:</span>
          {/if}
          {#if opt.shortLabel}
            <span class="sm:hidden">{opt.shortLabel}</span>
            <span class="hidden sm:inline">{opt.label}</span>
          {:else}
            <span>{opt.label}</span>
          {/if}
        </span>
      {/each}
      <span
        class="col-start-1 row-start-1 inline-flex min-w-0 items-center gap-1 truncate leading-none">
        {#if labelPrefix}
          <span class="shrink-0 font-normal text-text-muted"
            >{labelPrefix}:</span>
        {/if}
        <span class="truncate">{@render children()}</span>
      </span>
    </span>
  {:else}
    <span class="inline-flex min-w-0 items-center gap-1 truncate leading-none">
      {#if labelPrefix}
        <span class="shrink-0 font-normal text-text-muted">{labelPrefix}:</span>
      {/if}
      <span class="truncate">{@render children()}</span>
    </span>
  {/if}
  {#if !hideChevron}
    <span
      class={cn(
        'shrink-0 origin-center items-center justify-center transition-transform duration-200 ease-out',
        size === 'sm' ? 'size-3.5' : 'size-4',
        variant === 'primary' ? 'hidden text-white/80 sm:inline-flex'
        : isOpen ? 'inline-flex text-accent'
        : 'inline-flex text-text-muted',
        isOpen && 'rotate-180'
      )}>
      <ChevronDown class="{size === 'sm' ? 'size-3' : 'size-3'} leading-none" />
    </span>
  {/if}
</button>
