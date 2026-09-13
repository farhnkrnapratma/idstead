<script lang="ts">
  import type {Snippet} from 'svelte';
  import {cn} from '../utils/cn';

  interface Props {
    active?: boolean;
    disabled?: boolean;
    size?: 'sm' | 'md';
    onclick?: () => void;
    children?: Snippet;
    class?: string;
    title?: string;
    ariaLabel?: string;
  }

  let {
    active = false,
    disabled = false,
    size = 'md',
    onclick,
    children,
    class: className = '',
    title,
    ariaLabel
  }: Props = $props();

  const sizeStyles = {
    sm: 'px-2.5 py-1 text-xs gap-1.5',
    md: 'px-3.5 py-1.5 text-xs font-semibold gap-2'
  };
</script>

<button
  type="button"
  {disabled}
  {onclick}
  {title}
  aria-label={ariaLabel}
  aria-pressed={active}
  class={cn(
    'inline-flex cursor-pointer items-center justify-center rounded-md border transition-all select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-50',
    active ?
      'border-accent bg-accent font-bold text-text-on-accent shadow-xs'
    : 'border-border-default bg-surface text-text-secondary hover:border-border-strong hover:bg-surface-hover hover:text-text-primary disabled:hover:border-border-default disabled:hover:bg-surface disabled:hover:text-text-secondary',
    sizeStyles[size],
    className
  )}>
  {@render children?.()}
</button>
