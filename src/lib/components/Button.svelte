<script lang="ts">
  import type {Snippet} from 'svelte';
  import type {HTMLButtonAttributes} from 'svelte/elements';
  import {cn} from '../utils/cn';

  interface Props extends Omit<HTMLButtonAttributes, 'type'> {
    type?:
      'primary' | 'danger' | 'outline' | 'ghost' | 'secondary' | 'tertiary';
    tone?: 'neutral' | 'critical';
    htmlType?: 'button' | 'submit' | 'reset';
    size?: 'xs' | 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    fullWidth?: boolean;
    leading?: Snippet;
    trailing?: Snippet;
    showEscHint?: boolean;
    href?: string;
    target?: string;
    rel?: string;
    download?: boolean | string;
    children?: Snippet;
    responsiveIconOnly?: boolean;
    label?: string;
    truncateMiddle?: boolean;
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
    responsiveIconOnly = false,
    label,
    truncateMiddle = false,
    class: className = '',
    title,
    'aria-label': ariaLabel,
    children,
    ...restProps
  }: Props = $props();

  const baseStyles =
    'inline-flex min-w-0 items-center justify-center font-semibold whitespace-nowrap transition-all cursor-pointer select-none leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-50 disabled:cursor-not-allowed [&>svg]:shrink-0 [&>i]:shrink-0';

  const typeToneStyles: Record<string, string> = {
    'primary:neutral':
      'bg-accent text-text-on-accent hover:bg-accent-hover active:bg-accent-active disabled:hover:bg-accent disabled:active:bg-accent shadow-xs',
    'primary:critical':
      'bg-danger text-text-on-accent hover:bg-danger-hover active:bg-danger-hover disabled:hover:bg-danger shadow-xs',
    'secondary:neutral':
      'glass-button hover:border-accent disabled:hover:border-border-subtle/70',
    'secondary:critical':
      'border border-danger/30 bg-surface-card/55 text-danger shadow-xs backdrop-blur-sm hover:bg-danger-subtle/40 hover:border-danger/50 disabled:hover:bg-surface-card/55 dark:bg-surface-card/40 dark:hover:bg-danger-subtle/30',
    'tertiary:neutral':
      'border border-border-subtle/50 bg-surface-subtle text-text-secondary shadow-2xs hover:bg-surface-hover hover:text-text-primary hover:border-border-subtle/80 disabled:hover:bg-surface-subtle font-bold dark:bg-surface-subtle/40 dark:hover:bg-surface-hover',
    'tertiary:critical':
      'border border-danger/30 bg-danger-subtle/70 text-danger shadow-2xs hover:bg-danger-subtle disabled:hover:bg-danger-subtle/70 dark:bg-danger-subtle/40',
    'outline:neutral':
      'border border-border-subtle/60 bg-transparent text-text-primary shadow-2xs hover:bg-surface-hover hover:border-border-default disabled:hover:bg-transparent disabled:hover:border-border-subtle/60 dark:border-white/10 dark:hover:bg-surface-hover',
    'outline:critical':
      'border border-danger/40 bg-transparent text-danger shadow-2xs hover:bg-danger-subtle disabled:hover:bg-transparent',
    'ghost:neutral':
      'text-text-secondary hover:text-text-primary hover:bg-surface-hover disabled:hover:text-text-secondary disabled:hover:bg-transparent',
    'ghost:critical':
      'text-danger hover:text-danger-hover hover:bg-danger-subtle disabled:hover:text-danger disabled:hover:bg-transparent',
    'danger:critical':
      'border border-danger/30 bg-danger-subtle/70 text-danger backdrop-blur-sm hover:bg-danger hover:text-text-on-accent disabled:hover:bg-danger-subtle/70 shadow-xs dark:bg-danger-subtle/40 dark:hover:bg-danger'
  };

  const styleKey = $derived(
    type === 'danger' ? 'danger:critical' : `${type}:${tone}`
  );

  const sizeStyles = {
    xs: 'h-7.5 px-2.5 py-1.5 text-2xs gap-1 rounded-md',
    sm: 'h-8 px-3 text-xs gap-1.5 rounded-md',
    md: 'h-9 px-4 text-xs sm:text-sm gap-2 rounded-md',
    lg: 'h-11 px-5 text-sm gap-2.5 rounded-md'
  };

  const responsiveSizeStyles = {
    xs: 'size-8 shrink-0 p-0 text-2xs gap-1 rounded-md sm:h-7.5 sm:w-auto sm:px-2.5 sm:py-1.5 sm:text-2xs sm:gap-1',
    sm: 'size-8 shrink-0 p-0 text-xs gap-1.5 rounded-md sm:h-8 sm:w-auto sm:px-3 sm:text-xs sm:gap-1.5',
    md: 'size-8 shrink-0 p-0 text-xs gap-1.5 rounded-md sm:h-9 sm:w-auto sm:px-4 sm:text-xs sm:text-sm sm:gap-2',
    lg: 'size-8 shrink-0 p-0 text-xs gap-1.5 rounded-md sm:h-11 sm:w-auto sm:px-5 sm:text-sm sm:gap-2.5'
  };

  const splitLabel = $derived.by(() => {
    if (!label) return {prefix: '', suffix: '', hasSpace: false};
    const trimmed = label.trim();
    const lastSpaceIndex = trimmed.lastIndexOf(' ');
    if (lastSpaceIndex > 0) {
      return {
        prefix: trimmed.slice(0, lastSpaceIndex),
        suffix: trimmed.slice(lastSpaceIndex + 1),
        hasSpace: true
      };
    }
    const lastDotIndex = trimmed.lastIndexOf('.');
    if (lastDotIndex > 0 && trimmed.length - lastDotIndex <= 6) {
      return {
        prefix: trimmed.slice(0, lastDotIndex),
        suffix: trimmed.slice(lastDotIndex),
        hasSpace: false
      };
    }
    if (trimmed.length > 8) {
      const splitAt = Math.ceil(trimmed.length * 0.6);
      return {
        prefix: trimmed.slice(0, splitAt),
        suffix: trimmed.slice(splitAt),
        hasSpace: false
      };
    }
    return {prefix: trimmed, suffix: '', hasSpace: false};
  });

  const resolvedTitle = $derived(title || label || undefined);
  const resolvedAriaLabel = $derived(ariaLabel || label || undefined);
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
  title={resolvedTitle}
  aria-label={resolvedAriaLabel}
  class={cn(
    baseStyles,
    typeToneStyles[styleKey],
    responsiveIconOnly ? responsiveSizeStyles[size] : sizeStyles[size],
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
    <span class="inline-flex shrink-0 items-center justify-center leading-none">
      {@render leading()}
    </span>
  {/if}

  {#if label}
    {#if responsiveIconOnly}
      <span
        class="hidden sm:inline-flex sm:max-w-full sm:min-w-0 sm:items-center">
        {#if truncateMiddle}
          <span
            class="inline-flex max-w-full min-w-0 items-center overflow-hidden">
            <span class="min-w-0 shrink truncate">{splitLabel.prefix}</span>
            {#if splitLabel.suffix}
              <span class="shrink-0"
                >{#if splitLabel.hasSpace}&nbsp;{/if}{splitLabel.suffix}</span>
            {/if}
          </span>
        {:else}
          <span class="truncate">{label}</span>
        {/if}
      </span>
    {:else if truncateMiddle}
      <span class="inline-flex max-w-full min-w-0 items-center overflow-hidden">
        <span class="min-w-0 shrink truncate">{splitLabel.prefix}</span>
        {#if splitLabel.suffix}
          <span class="shrink-0"
            >{#if splitLabel.hasSpace}&nbsp;{/if}{splitLabel.suffix}</span>
        {/if}
      </span>
    {:else}
      <span class="truncate">{label}</span>
    {/if}
  {:else if responsiveIconOnly}
    <span class="hidden sm:inline-flex sm:items-center">
      {@render children?.()}
    </span>
  {:else}
    {@render children?.()}
  {/if}

  {#if trailing && !isLoading}
    <span class="inline-flex shrink-0 items-center justify-center leading-none">
      {@render trailing()}
    </span>
  {/if}

  {#if showEscHint && !isLoading}
    <kbd
      class="hidden items-center rounded-md border border-border-subtle/80 bg-surface-elevated/80 px-1 py-0.5 font-mono text-3xs leading-none text-text-muted select-none sm:inline-flex">
      Esc
    </kbd>
  {/if}
</svelte:element>
