<!-- @format -->
<script lang="ts">
  import type {HTMLTextareaAttributes} from 'svelte/elements'
  import {autoResize} from '$lib/actions'
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
    'w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-copilot focus:ring-2 focus:ring-copilot/20 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed'
</script>

{#if useAutoResize}
  <textarea
    use:autoResize={value}
    bind:value
    {rows}
    {disabled}
    class={cn(
      baseStyles,
      'no-scrollbar resize-none overflow-hidden',
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
