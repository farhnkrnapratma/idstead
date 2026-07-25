<!-- @format -->
<script lang="ts">
  import {cn} from '../utils/cn'

  interface Props {
    height?: string
    width?: string
    class?: string
  }

  let {
    height = 'h-16',
    width = 'w-full',
    class: className = ''
  }: Props = $props()
</script>

<div
  aria-hidden="true"
  class={cn(
    'animate-pulse rounded-2xl border border-border-subtle/40 bg-surface-subtle/80 select-none',
    height,
    width,
    className
  )}
></div>
