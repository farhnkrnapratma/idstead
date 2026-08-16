<script lang="ts">
  import type {HTMLTextareaAttributes} from 'svelte/elements'
  import {autoResize} from '$lib/utils/actions'
  import {cn} from '../utils/cn'

  interface Props extends HTMLTextareaAttributes {
    value?: string
    error?: boolean
    valid?: boolean
    useAutoResize?: boolean
  }

  let {
    value = $bindable(''),
    error = false,
    valid = false,
    useAutoResize = true,
    rows = 4,
    class: className = '',
    disabled = false,
    ...restProps
  }: Props = $props()

  const baseStyles =
    'w-full rounded-sm border border-border-subtle/70 bg-surface-card/85 backdrop-blur-xs px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/70 transition-colors focus:border-copilot focus:bg-surface-card focus:ring-2 focus:ring-copilot/20 focus:outline-none disabled:cursor-not-allowed disabled:backdrop-blur-none disabled:bg-surface-card/20 disabled:border-border-subtle/30 disabled:opacity-50 dark:border-white/10 dark:bg-surface-card/70 dark:focus:bg-surface-card/90'
</script>

{#if useAutoResize}
  <textarea
    use:autoResize={value}
    bind:value
    {rows}
    {disabled}
    class={cn(
      baseStyles,
      'resize-none scrollbar-none overflow-hidden [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
      error ? 'border-danger! ring-danger/20!' : '',
      valid && !error ? 'border-copilot!' : '',
      className
    )}
    {...restProps}></textarea>
{:else}
  <textarea
    bind:value
    {rows}
    {disabled}
    class={cn(
      baseStyles,
      error ? 'border-danger! ring-danger/20!' : '',
      valid && !error ? 'border-copilot!' : '',
      className
    )}
    {...restProps}></textarea>
{/if}
