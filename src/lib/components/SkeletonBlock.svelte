<script lang="ts">
  import {cn} from '../utils/cn';

  interface Props {
    height?: string;
    width?: string;
    class?: string;
  }

  let {
    height = 'h-16',
    width = 'w-full',
    class: className = ''
  }: Props = $props();
</script>

<div
  aria-hidden="true"
  class={cn(
    'animate-pulse rounded-md bg-black/[0.06] opacity-100 select-none dark:bg-white/[0.08]',
    height,
    width,
    className
  )}>
</div>
