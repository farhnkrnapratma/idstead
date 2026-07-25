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
    sm: 'h-8 text-xs rounded-md px-2.5',
    md: 'h-9 text-sm rounded-lg px-3',
    lg: 'h-11 text-base rounded-lg px-4'
  }
</script>

<div class={cn('relative flex items-center', fullWidth ? 'w-full' : '')}>
  {#if leadingIcon}
    <div
      class="pointer-events-none absolute left-3 z-10 flex items-center text-text-muted">
      <i class="bi {leadingIcon} text-sm" aria-hidden="true"></i>
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
      'border border-border-default bg-surface text-text-primary transition-colors placeholder:text-text-muted focus:border-copilot focus:ring-2 focus:ring-copilot/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
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
      class="pointer-events-none absolute right-3 z-10 flex items-center text-text-muted">
      <i class="bi {trailingIcon} text-sm" aria-hidden="true"></i>
    </div>
  {:else if trailingSlot}
    <div class="absolute right-2 z-10 flex items-center">
      {@render trailingSlot()}
    </div>
  {/if}
</div>
