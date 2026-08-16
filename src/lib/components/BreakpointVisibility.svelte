<script lang="ts">
  import type {Snippet} from 'svelte'
  import {cn} from '../utils/cn'

  interface Props {
    visibleOn?: 'mobile-only' | 'desktop-only' | 'tablet-and-up'
    class?: string
    children?: Snippet
  }

  let {
    visibleOn = 'desktop-only',
    class: className = '',
    children
  }: Props = $props()

  const visibilityStyles = {
    'mobile-only': 'block sm:hidden',
    'desktop-only': 'hidden sm:block',
    'tablet-and-up': 'hidden md:block'
  }
</script>

<div class={cn(visibilityStyles[visibleOn], className)}>
  {@render children?.()}
</div>
