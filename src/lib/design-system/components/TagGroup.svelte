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

<div class={cn('flex flex-wrap items-center gap-1.5 select-none', className)}>
  {@render children?.()}
</div>
