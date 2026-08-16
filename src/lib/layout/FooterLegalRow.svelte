<script lang="ts">
  import {cn} from '../utils/cn'
  import {consentStore} from '../stores/consentStore.svelte'

  interface Props {
    name?: string
    class?: string
  }

  let {name = '', class: className = ''}: Props = $props()
</script>

<div
  class={cn(
    'flex w-full max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 font-sans text-xs font-medium text-text-muted md:flex-nowrap',
    className
  )}>
  <span class="inline-flex shrink-0 items-center text-text-muted">
    &copy; {new Date().getFullYear()}{name ? ` ${name}.` : '.'}
  </span>
  <a
    href="/terms"
    class="inline-flex shrink-0 items-center transition-colors hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-none">
    Terms
  </a>
  <a
    href="/privacy"
    class="inline-flex shrink-0 items-center transition-colors hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-none">
    Privacy
  </a>
  <a
    href="/security"
    class="inline-flex shrink-0 items-center transition-colors hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-none">
    Security
  </a>
  <button
    type="button"
    onclick={() => consentStore.openCustomizeModal()}
    class="inline-flex shrink-0 cursor-pointer items-center transition-colors hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-none">
    Manage cookies
  </button>
  <a
    href="/sitemap.xml"
    class="inline-flex shrink-0 items-center transition-colors hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-none">
    Sitemap
  </a>
  <a
    href="/atom.xml"
    class="inline-flex shrink-0 items-center transition-colors hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-none">
    RSS
  </a>
</div>
