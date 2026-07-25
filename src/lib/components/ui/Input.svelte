<!-- @format -->
<script lang="ts">
  import type {HTMLInputAttributes} from 'svelte/elements'

  interface Props extends Omit<HTMLInputAttributes, 'size'> {
    value?: string | number
    error?: boolean
    valid?: boolean
    size?: 'sm' | 'md' | 'lg'
  }

  let {
    value = $bindable(''),
    error = false,
    valid = false,
    size = 'md',
    class: className = '',
    ...restProps
  }: Props = $props()

  const sizeStyles = {
    sm: 'h-8 px-2.5 text-xs rounded-md',
    md: 'h-9 px-3 text-sm rounded-lg',
    lg: 'h-11 px-4 text-base rounded-lg'
  }
</script>

<input
  bind:value
  class="w-full border border-border-default bg-surface-base text-text-primary transition-colors placeholder:text-text-muted focus:border-copilot focus:ring-2 focus:ring-copilot/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 {sizeStyles[
    size
  ]} {error ? 'border-danger! ring-danger/20!' : ''} {valid && !error ?
    'border-copilot!'
  : ''} {className}"
  {...restProps} />
