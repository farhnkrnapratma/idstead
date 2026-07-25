<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'
  import {cn} from '../utils/cn'

  interface Props {
    position?: 'inline' | 'sticky'
    align?: 'left' | 'between' | 'right'
    class?: string
    children?: Snippet
  }

  let {
    position = 'inline',
    align = 'right',
    class: className = '',
    children
  }: Props = $props()

  const alignStyles = {
    left: 'justify-start',
    between: 'justify-between',
    right: 'justify-end'
  }
</script>

<div
  class={cn(
    'flex w-full items-center gap-3',
    alignStyles[align],
    position === 'sticky' ?
      'sticky bottom-0 z-30 border-t border-border-subtle bg-surface/90 px-4 py-3 backdrop-blur-md'
    : 'py-2',
    className
  )}>
  {@render children?.()}
</div>
