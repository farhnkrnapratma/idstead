<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'
  import {cn} from '../utils/cn'

  interface Props {
    as?: string
    class?: string
    children?: Snippet
  }

  let {as = 'span', class: className = '', children}: Props = $props()
</script>

<svelte:element
  this={as}
  class={cn('sr-only', className)}>
  {@render children?.()}
</svelte:element>
