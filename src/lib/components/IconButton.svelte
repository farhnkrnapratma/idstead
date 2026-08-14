<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'
  import type {HTMLButtonAttributes} from 'svelte/elements'
  import {cn} from '../utils/cn'

  interface Props extends HTMLButtonAttributes {
    ariaLabel: string
    variant?: 'default' | 'ghost' | 'borderless'
    size?: 'sm' | 'md' | 'lg'
    children?: Snippet
  }

  let {
    ariaLabel,
    variant = 'default',
    size = 'md',
    class: className = '',
    children,
    type = 'button',
    ...restProps
  }: Props = $props()

  const variantStyles = {
    default:
      'border border-border-subtle/70 bg-surface-card/55 text-text-primary shadow-xs backdrop-blur-md hover:bg-surface-card/85 hover:text-copilot hover:border-copilot disabled:hover:bg-surface-card/55 disabled:hover:text-text-primary dark:border-white/10 dark:bg-surface-card/40 dark:hover:bg-surface-card/65',
    ghost:
      'text-text-secondary hover:text-text-primary disabled:hover:bg-transparent disabled:hover:text-text-secondary',
    borderless:
      'bg-transparent text-text-secondary hover:text-copilot disabled:hover:text-text-secondary'
  }

  const sizeStyles = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-11 w-11 text-base'
  }
</script>

<button
  {type}
  aria-label={ariaLabel}
  title={ariaLabel}
  class={cn(
    'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-sm transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-50 [&>i]:inline-flex [&>i]:items-center [&>i]:justify-center [&>i]:leading-none [&>svg]:block',
    variantStyles[variant],
    sizeStyles[size],
    className
  )}
  {...restProps}>
  {@render children?.()}
</button>
