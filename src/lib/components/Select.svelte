<script lang="ts">
  import type {HTMLSelectAttributes} from 'svelte/elements';
  import type {Snippet} from 'svelte';
  import {cn} from '../utils/cn';

  interface Props extends Omit<HTMLSelectAttributes, 'size'> {
    value?: string | number | null;
    error?: boolean;
    valid?: boolean;
    size?: 'sm' | 'md' | 'lg';
    children?: Snippet;
  }

  let {
    value = $bindable(undefined),
    error = false,
    valid = false,
    size = 'md',
    class: className = '',
    children,
    disabled = false,
    ...restProps
  }: Props = $props();

  const sizeStyles = {
    sm: 'h-8 px-2.5 text-xs rounded-md',
    md: 'h-9 px-3 text-sm rounded-md',
    lg: 'h-11 px-4 text-base rounded-md'
  };
</script>

<select
  bind:value
  {disabled}
  class={cn(
    'w-full border border-border-default/60 bg-surface-card/85 text-text-primary backdrop-blur-xs transition-colors focus:border-accent focus:bg-surface-card focus:ring-2 focus:ring-accent/20 focus:outline-none disabled:cursor-not-allowed disabled:border-border-subtle/30 disabled:bg-surface-card/20 disabled:opacity-50 disabled:backdrop-blur-none dark:border-white/15 dark:bg-surface-card/70 dark:focus:bg-surface-card/90',
    sizeStyles[size],
    error ? 'border-danger! ring-danger/20!' : '',
    valid && !error ? 'border-accent!' : '',
    className
  )}
  {...restProps}>
  {@render children?.()}
</select>
