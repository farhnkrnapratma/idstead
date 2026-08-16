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
    'divide-y divide-border-subtle overflow-hidden rounded-sm glass-card',
    className
  )}>
  {@render children?.()}
</div>
