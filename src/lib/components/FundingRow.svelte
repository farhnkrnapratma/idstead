<!-- @format -->
<script lang="ts">
  import {cn} from '../utils/cn'

  interface Props {
    platform: string
    description?: string
    icon?: string
    href: string
    badge?: string
    class?: string
  }

  let {
    platform,
    description = '',
    icon = 'bi-heart-fill',
    href,
    badge = '',
    class: className = ''
  }: Props = $props()
</script>

<a
  {href}
  target="_blank"
  rel="noopener noreferrer"
  class={cn(
    'group flex items-center justify-between gap-4 rounded-sm border border-border-subtle bg-surface/40 p-4 transition-all duration-300 select-none hover:border-border-strong hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
    className
  )}>
  <div class="flex min-w-0 items-center gap-3.5">
    <div
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border-subtle bg-surface text-copilot transition-transform group-hover:scale-105">
      <i
        class="bi {icon} text-base"
        aria-hidden="true"></i>
    </div>
    <div class="flex min-w-0 flex-col">
      <div class="flex items-center gap-2">
        <span
          class="truncate text-xs font-bold text-text-primary transition-colors group-hover:text-copilot">
          {platform}
        </span>
        {#if badge}
          <span
            class="rounded-sm bg-copilot-subtle/40 px-1.5 py-px text-2xs font-bold text-copilot">
            {badge}
          </span>
        {/if}
      </div>
      {#if description}
        <span class="truncate text-xxs text-text-muted">{description}</span>
      {/if}
    </div>
  </div>

  <div
    class="flex shrink-0 items-center gap-1.5 text-xs font-medium text-text-muted transition-colors group-hover:text-copilot">
    <span>Sponsor</span>
    <i
      class="bi bi-box-arrow-up-right text-2xs"
      aria-hidden="true"></i>
  </div>
</a>
