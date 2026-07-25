<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'
  import {cn} from '../utils/cn'

  interface Props {
    columns?: 1 | 2 | 3 | 4
    gap?: 'sm' | 'md' | 'lg'
    class?: string
    children?: Snippet
  }

  let {
    columns = 2,
    gap = 'md',
    class: className = '',
    children
  }: Props = $props()

  const gridStyles = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
  }

  const gapStyles = {
    sm: 'gap-3 sm:gap-4',
    md: 'gap-4 sm:gap-6',
    lg: 'gap-6 sm:gap-8'
  }
</script>

<div class={cn('grid w-full', gridStyles[columns], gapStyles[gap], className)}>
  {@render children?.()}
</div>
