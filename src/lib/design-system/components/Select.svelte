<!-- @format -->
<script lang="ts">
  import type {HTMLSelectAttributes} from 'svelte/elements'
  import type {Snippet} from 'svelte'
  import {cn} from '../utils/cn'

  interface Props extends Omit<HTMLSelectAttributes, 'size'> {
    value?: string | number | null
    error?: boolean
    valid?: boolean
    size?: 'sm' | 'md' | 'lg'
    children?: Snippet
  }

  let {
    value = $bindable(undefined),
    error = false,
    valid = false,
    size = 'md',
    class: className = '',
    children,
    disabled = false,
    ...restProps
  }: Props = $props()

  const sizeStyles = {
    sm: 'h-8 px-2.5 text-xs rounded-md',
    md: 'h-9 px-3 text-sm rounded-lg',
    lg: 'h-11 px-4 text-base rounded-lg'
  }
</script>

<select
  bind:value
  {disabled}
  class={cn(
    'w-full border border-border-subtle bg-surface text-text-primary transition-colors focus:border-copilot focus:ring-2 focus:ring-copilot/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
    sizeStyles[size],
    error ? 'border-danger! ring-danger/20!' : '',
    valid && !error ? 'border-copilot!' : '',
    className
  )}
  {...restProps}>
  {@render children?.()}
</select>
