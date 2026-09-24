<script lang="ts">
  import type {Snippet} from 'svelte';
  import type {HTMLButtonAttributes} from 'svelte/elements';
  import {cn} from '../utils/cn';

  interface Props extends Omit<HTMLButtonAttributes, 'children' | 'class'> {
    variant?: 'neutral' | 'subtle' | 'accent';
    size?: 'sm' | 'md';
    children?: Snippet;
    class?: string;
  }

  let {
    variant = 'neutral',
    size = 'sm',
    children,
    class: className = '',
    onclick,
    disabled = false,
    ...rest
  }: Props = $props();

  const variantStyles = {
    neutral: 'text-text-muted border border-text-muted/20',
    subtle: 'bg-text-muted/10 text-text-muted',
    accent: 'bg-accent-subtle text-accent border border-accent/20'
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs leading-snug',
    md: 'px-2.5 py-1 text-sm leading-snug'
  };
</script>

<svelte:element
  this={onclick ? 'button' : 'span'}
  type={onclick ? 'button' : undefined}
  {onclick}
  disabled={onclick ? disabled : undefined}
  {...rest}
  class={cn(
    'inline-block max-w-full rounded-full whitespace-normal',
    variantStyles[variant],
    sizeStyles[size],
    onclick
      && 'cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-50',
    className
  )}>
  {@render children?.()}
</svelte:element>
