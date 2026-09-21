<script lang="ts">
  import type {Snippet} from 'svelte';
  import {cn} from '../utils/cn';

  interface Props {
    variant?: 'neutral' | 'subtle' | 'accent';
    size?: 'sm' | 'md';
    children?: Snippet;
    class?: string;
  }

  let {
    variant = 'neutral',
    size = 'sm',
    children,
    class: className = ''
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

<span
  class={cn(
    'inline-block max-w-full rounded-full whitespace-normal',
    variantStyles[variant],
    sizeStyles[size],
    className
  )}>
  {@render children?.()}
</span>
