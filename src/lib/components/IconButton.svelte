<script lang="ts">
  import type {Snippet} from 'svelte';
  import type {HTMLButtonAttributes} from 'svelte/elements';
  import {cn} from '../utils/cn';

  interface Props extends HTMLButtonAttributes {
    ariaLabel: string;
    variant?: 'default' | 'ghost' | 'borderless';
    size?: 'sm' | 'md' | 'lg';
    tooltip?: string;
    tooltipPlacement?: 'top' | 'bottom';
    tooltipAlign?: 'center' | 'left' | 'right';
    showTooltip?: boolean;
    children?: Snippet;
  }

  let {
    ariaLabel,
    variant = 'default',
    size = 'md',
    tooltip,
    tooltipPlacement = 'bottom',
    tooltipAlign = 'center',
    showTooltip = true,
    class: className = '',
    children,
    type = 'button',
    ...restProps
  }: Props = $props();

  let tooltipContent = $derived(tooltip ?? ariaLabel);

  const variantStyles = {
    default:
      'glass-button hover:text-copilot hover:border-copilot disabled:hover:text-text-primary',
    ghost:
      'text-text-secondary hover:text-text-primary disabled:hover:bg-transparent disabled:hover:text-text-secondary',
    borderless:
      'bg-transparent text-text-secondary hover:text-copilot disabled:hover:text-text-secondary'
  };

  const sizeStyles = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-11 w-11 text-base'
  };
</script>

<div class="group relative inline-flex">
  <button
    {type}
    aria-label={ariaLabel}
    class={cn(
      'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-sm transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-50 [&>i]:inline-flex [&>i]:items-center [&>i]:justify-center [&>i]:leading-none [&>svg]:block',
      variantStyles[variant],
      sizeStyles[size],
      className
    )}
    {...restProps}>
    {@render children?.()}
  </button>

  {#if showTooltip && tooltipContent}
    <div
      role="tooltip"
      class={cn(
        'pointer-events-none absolute z-70 rounded-sm glass-overlay px-2 py-1 text-3xs font-medium whitespace-nowrap text-text-primary opacity-0 shadow-lg transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100',
        tooltipPlacement === 'top' ?
          'bottom-[calc(100%+6px)]'
        : 'top-[calc(100%+6px)]',
        tooltipAlign === 'right' ? 'right-0'
        : tooltipAlign === 'left' ? 'left-0'
        : 'left-1/2 -translate-x-1/2'
      )}>
      <span class="relative z-10">{tooltipContent}</span>
    </div>
  {/if}
</div>
