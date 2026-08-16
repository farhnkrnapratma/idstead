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
    'text-xs font-semibold whitespace-nowrap text-text-primary select-none',
    className
  )}
  aria-live="polite"
  aria-atomic="true">
  Showing <span class="font-bold text-copilot">{count}</span> of
  <span class="font-bold text-copilot">{total}</span>
  {itemLabel}
</div>
