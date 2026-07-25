<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'

  interface Props {
    title: string
    subtitle?: string
    href?: string
    target?: string
    rel?: string
    icon?: string
    iconColor?: string
    actions?: Snippet
    children?: Snippet
    class?: string
  }

  let {
    title,
    subtitle = '',
    href,
    target,
    rel,
    icon = '',
    iconColor = 'text-text-secondary',
    actions,
    children,
    class: className = ''
  }: Props = $props()
</script>

{#if href}
  <a
    {href}
    {target}
    {rel}
    class="group flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-surface-hover {className}">
    <div class="flex min-w-0 shrink-0 items-center gap-3.5">
      {#if icon}
        <i
          class="bi {icon} text-lg {iconColor} transition-colors group-hover:text-copilot"
          aria-hidden="true"></i>
      {/if}
      <div class="flex min-w-0 flex-col">
        <span class="truncate text-sm font-semibold text-text-primary"
          >{title}</span>
        {#if subtitle}
          <span class="mt-0.5 truncate text-xs text-text-muted"
            >{subtitle}</span>
        {/if}
      </div>
    </div>
    <div class="flex min-w-0 items-center justify-end gap-3">
      {@render children?.()}
      <span
        class="material-symbols-rounded shrink-0 leading-none text-text-muted transition-colors select-none group-hover:text-copilot"
        style="font-size: 16px; font-variation-settings: 'wght' 400, 'opsz' 20;"
        aria-hidden="true">open_in_new</span>
    </div>
  </a>
{:else}
  <div
    class="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-surface-hover {className}">
    <div class="flex min-w-0 shrink-0 items-center gap-3.5">
      {#if icon}
        <i class="bi {icon} text-lg {iconColor}" aria-hidden="true"></i>
      {/if}
      <div class="flex min-w-0 flex-col">
        <span class="truncate text-sm font-semibold text-text-primary"
          >{title}</span>
        {#if subtitle}
          <span class="mt-0.5 truncate text-xs text-text-muted"
            >{subtitle}</span>
        {/if}
      </div>
    </div>
    <div class="flex items-center justify-end gap-3">
      {@render children?.()}
      {@render actions?.()}
    </div>
  </div>
{/if}
