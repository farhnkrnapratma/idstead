<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'
  import {cn} from '../utils/cn'

  interface Props {
    align?: 'left' | 'center' | 'right' | 'between'
    class?: string
    children?: Snippet
  }

  let {align = 'right', class: className = '', children}: Props = $props()

  const alignStyles = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between'
  }
</script>

<div
  class={cn(
    'mt-4 flex items-center gap-3 border-t border-border-subtle/50 pt-3',
    alignStyles[align],
    className
  )}
>
  {@render children?.()}
</div>
