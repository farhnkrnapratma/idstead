<!-- @format -->
<script lang="ts">
  import {cn} from '../utils/cn'

  interface Props {
    label: string
    href: string
    class?: string
  }

  let {label, href, class: className = ''}: Props = $props()
</script>

<div
  class={cn(
    'mt-6 flex items-center justify-end border-t border-border-subtle/50 pt-4 select-none',
    className
  )}>
  <a
    {href}
    class="group inline-flex items-center gap-1.5 rounded-sm text-xs font-semibold text-text-secondary transition-colors hover:text-copilot focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
    <span>{label}</span>
    <i
      class="bi bi-arrow-right text-xs leading-none transition-transform select-none group-hover:translate-x-1"
      aria-hidden="true"></i>
  </a>
</div>
