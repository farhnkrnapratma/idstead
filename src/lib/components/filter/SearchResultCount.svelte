<script lang="ts">
  import {cn} from '../../utils/cn';

  interface Props {
    count: number;
    total: number;
    itemLabel?: string;
    class?: string;
  }

  let {
    count,
    total,
    itemLabel = 'items',
    class: className = ''
  }: Props = $props();
</script>

<div
  class={cn(
    'text-xs font-normal whitespace-nowrap text-text-secondary select-none',
    className
  )}
  aria-live="polite"
  aria-atomic="true">
  Showing <span class="font-bold text-accent">{count}</span> of
  <span class="font-bold text-accent">{total}</span>
  {itemLabel}
</div>
