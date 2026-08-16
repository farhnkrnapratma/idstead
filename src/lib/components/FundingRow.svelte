<script lang="ts">
  import {ExternalLink} from '@lucide/svelte'
  import {cn} from '../utils/cn'

  interface Props {
    platform: string
    description?: string
    href: string
    badge?: string
    class?: string
  }

  let {
    platform,
    description = '',
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
    'group flex items-center justify-between gap-3 rounded-sm border border-border-subtle bg-surface/40 px-3.5 py-2.5 transition-all duration-300 select-none hover:border-border-strong hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
    className
  )}>
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

  <div
    class="flex shrink-0 items-center gap-1.5 text-xs font-medium text-text-muted transition-colors group-hover:text-copilot">
    <span>Sponsor</span>
    <ExternalLink class="size-3.5" />
  </div>
</a>
