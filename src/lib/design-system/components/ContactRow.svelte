<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'
  import {cn} from '../utils/cn'

  interface Props {
    title: string
    subtitle?: string
    icon?: string
    href?: string
    copyableText?: string
    class?: string
    trailing?: Snippet
  }

  let {
    title,
    subtitle = '',
    icon = 'bi-envelope',
    href = '',
    copyableText = '',
    class: className = '',
    trailing
  }: Props = $props()

  let copied = $state(false)

  function handleCopy() {
    if (!copyableText || typeof window === 'undefined') return
    navigator.clipboard.writeText(copyableText).then(() => {
      copied = true
      setTimeout(() => (copied = false), 2000)
    })
  }
</script>

<div
  class={cn(
    'group flex items-center justify-between gap-4 rounded-xl border border-border-subtle bg-surface/40 p-4 transition-all duration-300 hover:border-border-strong hover:bg-surface-hover',
    className
  )}>
  <div class="flex min-w-0 items-center gap-3.5">
    <div
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface text-text-secondary transition-colors group-hover:text-copilot">
      <i class="bi {icon} text-base" aria-hidden="true"></i>
    </div>
    <div class="flex min-w-0 flex-col">
      {#if href}
        <a
          {href}
          target={href.startsWith('http') ? '_blank' : undefined}
          rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
          class="truncate text-xs font-bold text-text-primary transition-colors hover:text-copilot focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
          {title}
        </a>
      {:else}
        <span class="truncate text-xs font-bold text-text-primary"
          >{title}</span>
      {/if}
      {#if subtitle}
        <span class="truncate text-[11px] text-text-muted">{subtitle}</span>
      {/if}
    </div>
  </div>

  <div class="flex shrink-0 items-center gap-2">
    {#if copyableText}
      <button
        type="button"
        onclick={handleCopy}
        aria-label="Copy contact information"
        class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-2.5 text-[11px] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-focus-ring">
        {#if copied}
          <i class="bi bi-check2 text-copilot" aria-hidden="true"></i>
          <span class="text-copilot">Copied</span>
        {:else}
          <i class="bi bi-clipboard" aria-hidden="true"></i>
          <span>Copy</span>
        {/if}
      </button>
    {/if}

    {#if trailing}
      {@render trailing()}
    {/if}
  </div>
</div>
