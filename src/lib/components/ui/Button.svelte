<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'
  import type {HTMLButtonAttributes} from 'svelte/elements'

  interface Props extends HTMLButtonAttributes {
    variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
    size?: 'sm' | 'md' | 'lg'
    isLoading?: boolean
    showEscHint?: boolean
    children?: Snippet
  }

  let {
    variant = 'primary',
    size = 'md',
    isLoading = false,
    showEscHint = false,
    disabled = false,
    class: className = '',
    children,
    type = 'button',
    ...restProps
  }: Props = $props()

  const baseStyles =
    'inline-flex items-center justify-center font-semibold rounded-lg transition-all cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-50 disabled:cursor-not-allowed'

  const variantStyles = {
    primary: 'bg-copilot text-text-on-accent hover:bg-copilot-hover shadow-xs',
    secondary:
      'border border-border-default bg-surface-card text-text-primary hover:bg-surface-hover hover:border-border-strong shadow-xs',
    ghost:
      'bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary',
    destructive: 'bg-[#FE4C25] text-white hover:bg-[#e03e19] shadow-xs'
  }

  const sizeStyles = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-9 px-4 text-xs sm:text-sm gap-2',
    lg: 'h-11 px-5 text-sm gap-2.5'
  }
</script>

<button
  {type}
  disabled={disabled || isLoading}
  class="{baseStyles} {variantStyles[variant]} {sizeStyles[size]} {className}"
  {...restProps}>
  {#if isLoading}
    <svg
      class="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true">
      <circle
        class="stroke-copilot stroke-3 opacity-25"
        cx="12"
        cy="12"
        r="10"></circle>
      <path
        class="fill-copilot opacity-75"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  {/if}

  {@render children?.()}

  {#if showEscHint && !isLoading}
    <kbd
      class="hidden items-center rounded border border-border-subtle/80 bg-surface-elevated/80 px-1 py-0.5 font-mono text-[9px] leading-none text-text-muted select-none sm:inline-flex">
      Esc
    </kbd>
  {/if}
</button>
