<!-- @format -->
<script lang="ts">
  import type {HTMLTextareaAttributes} from 'svelte/elements'
  import {autoResize} from '$lib/utils/actions'

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
    ...restProps
  }: Props = $props()
</script>

{#if useAutoResize}
  <textarea
    use:autoResize={value}
    bind:value
    {rows}
    class="no-scrollbar w-full resize-none overflow-hidden rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary transition-colors placeholder:text-text-muted focus:border-copilot focus:ring-2 focus:ring-copilot/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 {(
      error
    ) ?
      'border-danger! ring-danger/20!'
    : ''} {valid && !error ? 'border-copilot!' : ''} {className}"
    {...restProps}></textarea>
{:else}
  <textarea
    bind:value
    {rows}
    class="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary transition-colors placeholder:text-text-muted focus:border-copilot focus:ring-2 focus:ring-copilot/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 {(
      error
    ) ?
      'border-danger! ring-danger/20!'
    : ''} {valid && !error ? 'border-copilot!' : ''} {className}"
    {...restProps}></textarea>
{/if}
