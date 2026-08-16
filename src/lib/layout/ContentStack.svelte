<script lang="ts">
  import type {Snippet} from 'svelte'
  import {cn} from '../utils/cn'

  interface Props {
    gap?: 'sm' | 'md' | 'lg' | 'xl'
    class?: string
    children?: Snippet
  }

  let {gap = 'md', class: className = '', children}: Props = $props()

  const gapStyles = {sm: 'gap-3', md: 'gap-6', lg: 'gap-8', xl: 'gap-12'}
</script>

<div class={cn('flex w-full flex-col', gapStyles[gap], className)}>
  {@render children?.()}
</div>
