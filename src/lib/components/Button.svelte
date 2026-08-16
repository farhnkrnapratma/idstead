<script lang="ts">
  import type {Snippet} from 'svelte'
  import type {HTMLButtonAttributes} from 'svelte/elements'
  import {cn} from '../utils/cn'

  interface Props extends Omit<HTMLButtonAttributes, 'type'> {
    type?: 'primary' | 'danger' | 'outline' | 'ghost' | 'secondary' | 'tertiary'
    tone?: 'neutral' | 'critical'
    htmlType?: 'button' | 'submit' | 'reset'
    size?: 'sm' | 'md' | 'lg'
    isLoading?: boolean
    fullWidth?: boolean
    leading?: Snippet
    trailing?: Snippet
    showEscHint?: boolean
    href?: string
    target?: string
    rel?: string
    download?: boolean | string
    children?: Snippet
  }

  let {
    type = 'primary',
    tone = 'neutral',
    htmlType = 'button',
    size = 'md',
    isLoading = false,
    disabled = false,
    fullWidth = false,
    leading,
    trailing,
    showEscHint = false,
    href = '',
    target,
    rel,
    download,
    class: className = '',
    children,
    ...restProps
  }: Props = $props()

  const baseStyles =
    'inline-flex items-center justify-center font-semibold whitespace-nowrap transition-all cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-50 disabled:cursor-not-allowed'

  const typeToneStyles: Record<string, string> = {
    'primary:neutral':
      'bg-copilot text-text-on-accent hover:bg-copilot-hover active:bg-copilot-active disabled:hover:bg-copilot disabled:active:bg-copilot shadow-xs',
    'primary:critical':
      'bg-danger text-text-on-accent hover:bg-danger-hover active:bg-danger-hover disabled:hover:bg-danger shadow-xs',
    'secondary:neutral':
      'glass-button hover:border-copilot disabled:hover:border-border-subtle/70',
    'secondary:critical':
      'border border-danger/30 bg-surface-card/55 text-danger shadow-xs backdrop-blur-sm hover:bg-danger-subtle/40 hover:border-danger/50 disabled:hover:bg-surface-card/55 dark:bg-surface-card/40 dark:hover:bg-danger-subtle/30',
    'tertiary:neutral':
      'border border-border-default/60 bg-surface-subtle text-text-secondary hover:bg-surface-hover hover:text-text-primary hover:border-border-default disabled:hover:bg-surface-subtle font-bold dark:bg-surface-subtle/40 dark:hover:bg-surface-hover',
    'tertiary:critical':
      'border border-danger/30 bg-danger-subtle/70 text-danger hover:bg-danger-subtle disabled:hover:bg-danger-subtle/70 dark:bg-danger-subtle/40',
    'outline:neutral':
      'border border-border-default bg-transparent text-text-primary hover:bg-surface-hover hover:border-border-strong disabled:hover:bg-transparent disabled:hover:border-border-default dark:hover:bg-surface-hover',
    'outline:critical':
      'border border-danger bg-transparent text-danger hover:bg-danger-subtle disabled:hover:bg-transparent',
    'ghost:neutral':
      'text-text-secondary hover:text-text-primary hover:bg-surface-hover disabled:hover:text-text-secondary disabled:hover:bg-transparent',
    'ghost:critical':
      'text-danger hover:text-danger-hover hover:bg-danger-subtle disabled:hover:text-danger disabled:hover:bg-transparent',
    'danger:critical':
      'border border-danger/30 bg-danger-subtle/70 text-danger backdrop-blur-sm hover:bg-danger hover:text-text-on-accent disabled:hover:bg-danger-subtle/70 shadow-xs dark:bg-danger-subtle/40 dark:hover:bg-danger'
  }

  const styleKey = $derived(
    type === 'danger' ? 'danger:critical' : `${type}:${tone}`
  )

  const sizeStyles = {
    sm: 'h-8 px-3 text-xs gap-1.5 rounded-sm',
    md: 'h-9 px-4 text-xs sm:text-sm gap-2 rounded-sm',
    lg: 'h-11 px-5 text-sm gap-2.5 rounded-sm'
  }
</script>

<svelte:element
  this={href ? 'a' : 'button'}
  href={href || undefined}
  {target}
  {rel}
  download={href ?
    download === true ?
      ''
    : download
  : undefined}
  type={href ? undefined : htmlType}
  disabled={href ? undefined : disabled || isLoading}
  aria-disabled={href && (disabled || isLoading) ? 'true' : undefined}
  tabindex={href && (disabled || isLoading) ? -1 : undefined}
  class={cn(
    baseStyles,
    typeToneStyles[styleKey],
    sizeStyles[size],
    fullWidth ? 'w-full' : '',
    className
  )}
  {...restProps}>
  {#if isLoading}
    <svg
      class="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true">
      <circle
        class="stroke-text-on-accent stroke-3 opacity-25"
        cx="12"
        cy="12"
        r="10"></circle>
      <path
        class="fill-text-on-accent opacity-75"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  {:else if leading}
    {@render leading()}
  {/if}

  {@render children?.()}

  {#if trailing && !isLoading}
    {@render trailing()}
  {/if}

  {#if showEscHint && !isLoading}
    <kbd
      class="hidden items-center rounded-sm border border-border-subtle/80 bg-surface-elevated/80 px-1 py-0.5 font-mono text-3xs leading-none text-text-muted select-none sm:inline-flex">
      Esc
    </kbd>
  {/if}
</svelte:element>
