<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'
  import {cn} from '../utils/cn'

  interface Props {
    class?: string
    children?: Snippet
  }

  let {class: className = '', children}: Props = $props()
</script>

<div
  class={cn(
    'fixed right-0 bottom-0 left-0 z-40 flex items-center justify-between gap-3 border-t border-border-subtle bg-surface/90 p-3.5 shadow-2xl backdrop-blur-lg select-none sm:hidden',
    className
  )}
>
  {@render children?.()}
</div>
