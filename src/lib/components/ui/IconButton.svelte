<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'
  import type {HTMLButtonAttributes} from 'svelte/elements'

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
      'border border-border-subtle bg-surface-card text-text-primary hover:bg-surface-hover hover:text-copilot shadow-xs',
    ghost:
      'border border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary',
    borderless: 'bg-transparent text-text-secondary hover:text-copilot'
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
  class="inline-flex cursor-pointer items-center justify-center rounded-lg transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-50 {variantStyles[
    variant
  ]} {sizeStyles[size]} {className}"
  {...restProps}>
  {@render children?.()}
</button>
