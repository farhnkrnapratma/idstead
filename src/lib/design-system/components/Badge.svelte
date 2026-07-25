<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'
  import {cn} from '../utils/cn'

  interface Props {
    variant?: 'default' | 'accent' | 'success' | 'warning' | 'danger'
    size?: 'sm' | 'md'
    children?: Snippet
    class?: string
  }

  let {
    variant = 'default',
    size = 'sm',
    children,
    class: className = ''
  }: Props = $props()

  const variantStyles = {
    default:
      'bg-border-subtle/50 text-text-secondary border border-border-subtle',
    accent: 'bg-copilot-subtle text-copilot border border-copilot/30 font-bold',
    success:
      'bg-success-subtle text-success border border-success/30 font-bold',
    warning:
      'bg-warning-subtle text-warning border border-warning/30 font-bold',
    danger: 'bg-danger-subtle text-danger border border-danger/30 font-bold'
  }

  const sizeStyles = {sm: 'px-2 py-0.5 text-[10px]', md: 'px-2.5 py-1 text-xs'}
</script>

<span
  class={cn(
    'inline-flex items-center gap-1 rounded-md font-semibold tracking-wide select-none',
    variantStyles[variant],
    sizeStyles[size],
    className
  )}
>
  {@render children?.()}
</span>
