<!-- @format -->
<script lang="ts">
  import {cn} from '../utils/cn'

  interface Props {
    targetId?: string
    label?: string
    class?: string
  }

  let {
    targetId = 'main-content',
    label = 'Skip to main content',
    class: className = ''
  }: Props = $props()
</script>

<a
  href={`#${targetId}`}
  class={cn(
    'sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-1000 focus:rounded-sm focus:bg-copilot focus:px-4 focus:py-2.5 focus:text-xs focus:font-bold focus:text-text-on-accent focus:shadow-2xl focus:ring-2 focus:ring-copilot focus:outline-none',
    className
  )}>
  {label}
</a>
