<script lang="ts">
  import type {Snippet} from 'svelte';
  import {cn} from '../utils/cn';

  interface Props {
    direction?: 'col-to-row' | 'row-to-col';
    gap?: 'sm' | 'md' | 'lg';
    align?: 'start' | 'center' | 'end' | 'between';
    class?: string;
    children?: Snippet;
  }

  let {
    direction = 'col-to-row',
    gap = 'md',
    align = 'start',
    class: className = '',
    children
  }: Props = $props();

  const directionStyles = {
    'col-to-row': 'flex flex-col sm:flex-row',
    'row-to-col': 'flex flex-row sm:flex-col'
  };

  const gapStyles = {
    sm: 'gap-2 sm:gap-3',
    md: 'gap-4 sm:gap-6',
    lg: 'gap-6 sm:gap-8'
  };

  const alignStyles = {
    start: 'items-start sm:items-center',
    center: 'items-center justify-center',
    end: 'items-end',
    between: 'items-start sm:items-center justify-between'
  };
</script>

<div
  class={cn(
    'w-full',
    directionStyles[direction],
    gapStyles[gap],
    alignStyles[align],
    className
  )}>
  {@render children?.()}
</div>
