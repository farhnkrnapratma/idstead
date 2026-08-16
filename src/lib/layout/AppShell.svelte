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
    'flex min-h-screen flex-col bg-background font-sans text-text-primary transition-colors duration-300',
    className
  )}>
  {@render children?.()}
</div>
