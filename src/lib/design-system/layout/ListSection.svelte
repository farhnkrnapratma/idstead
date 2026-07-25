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
    'divide-y divide-border-subtle overflow-hidden rounded-2xl border border-border-subtle bg-surface/60 shadow-xs backdrop-blur-lg transition-colors duration-300',
    className
  )}
>
  {@render children?.()}
</div>
