<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'
  import type {HTMLInputAttributes} from 'svelte/elements'
  import {cn} from '../utils/cn'

  interface Props extends Omit<HTMLInputAttributes, 'size'> {
    value?: string | number
    error?: boolean
    valid?: boolean
    size?: 'sm' | 'md' | 'lg'
    fullWidth?: boolean
    leadingIcon?: string
    trailingIcon?: string
    leadingSlot?: Snippet
    trailingSlot?: Snippet
  }

  let {
    value = $bindable(''),
    error = false,
    valid = false,
    size = 'md',
    fullWidth = true,
    leadingIcon = '',
    trailingIcon = '',
    leadingSlot,
    trailingSlot,
    class: className = '',
    disabled = false,
    ...restProps
  }: Props = $props()

  const sizeStyles = {
    sm: 'h-8 text-xs rounded-sm px-2.5',
    md: 'h-9 text-sm rounded-sm px-3',
    lg: 'h-11 text-base rounded-sm px-4'
  }
</script>

<div class={cn('relative flex items-center', fullWidth ? 'w-full' : '')}>
  {#if leadingIcon}
    <div
      class="pointer-events-none absolute left-3 z-10 flex items-center text-text-secondary">
      <i
        class="bi {leadingIcon} text-sm"
        aria-hidden="true"></i>
    </div>
  {:else if leadingSlot}
    <div class="absolute left-2 z-10 flex items-center">
      {@render leadingSlot()}
    </div>
  {/if}

  <input
    bind:value
    {disabled}
    class={cn(
      'border border-border-subtle/70 bg-surface-card/50 text-text-primary backdrop-blur-md transition-colors placeholder:text-text-secondary/70 focus:border-copilot focus:bg-surface-card/75 focus:ring-2 focus:ring-copilot/20 focus:outline-none disabled:cursor-not-allowed disabled:border-border-subtle/30 disabled:bg-surface-card/20 disabled:opacity-50 disabled:backdrop-blur-none dark:border-white/10 dark:bg-surface-card/35 dark:focus:bg-surface-card/60',
      fullWidth ? 'w-full' : '',
      sizeStyles[size],
      leadingIcon || leadingSlot ? 'pl-9' : '',
      trailingIcon || trailingSlot ? 'pr-9' : '',
      error ? 'border-danger! ring-danger/20!' : '',
      valid && !error ? 'border-copilot! ring-copilot/20!' : '',
      className
    )}
    {...restProps} />

  {#if trailingIcon}
    <div
      class="pointer-events-none absolute right-3 z-10 flex items-center text-text-secondary">
      <i
        class="bi {trailingIcon} text-sm"
        aria-hidden="true"></i>
    </div>
  {:else if trailingSlot}
    <div class="absolute right-2 z-10 flex items-center">
      {@render trailingSlot()}
    </div>
  {/if}
</div>
