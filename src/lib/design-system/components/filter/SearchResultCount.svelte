<!-- @format -->
<script lang="ts">
  import {cn} from '../../utils/cn'

  interface Props {
    count: number
    total: number
    itemLabel?: string
    class?: string
  }

  let {
    count,
    total,
    itemLabel = 'items',
    class: className = ''
  }: Props = $props()
</script>

<div
  class={cn(
    'text-xs font-medium whitespace-nowrap text-text-muted select-none',
    className
  )}
  aria-live="polite"
  aria-atomic="true"
>
  Showing <span class="font-semibold text-text-secondary">{count}</span> of
  <span class="font-semibold text-text-secondary">{total}</span>
  {itemLabel}
</div>
