<script lang="ts">
  import type {Snippet} from 'svelte'
  import {cn} from '../utils/cn'

  interface Props {
    variant?: 'neutral' | 'subtle' | 'accent'
    size?: 'sm' | 'md'
    children?: Snippet
    class?: string
  }

  let {
    variant = 'neutral',
    size = 'sm',
    children,
    class: className = ''
  }: Props = $props()

  const variantStyles = {
    neutral:
      'bg-surface-subtle text-text-secondary border border-border-subtle',
    subtle: 'bg-border-subtle/40 text-text-muted border border-transparent',
    accent: 'bg-copilot-subtle text-copilot border border-copilot/20 font-bold'
  }

  const sizeStyles = {sm: 'px-2 py-0.5 text-xxs', md: 'px-2.5 py-1 text-xs'}
</script>

<span
  class={cn(
    'inline-flex items-center gap-1 rounded-sm font-medium tracking-normal select-none',
    variantStyles[variant],
    sizeStyles[size],
    className
  )}>
  {@render children?.()}
</span>
