<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'
  import {cn} from '../utils/cn'

  interface Props {
    name: string
    role?: string
    avatarUrl?: string
    bio?: string
    class?: string
    actions?: Snippet
  }

  let {
    name,
    role = '',
    avatarUrl = '',
    bio = '',
    class: className = '',
    actions
  }: Props = $props()
</script>

<div
  class={cn(
    'flex flex-col gap-4 rounded-2xl border border-border-subtle bg-surface/60 p-5 shadow-xs backdrop-blur-lg select-none sm:p-6',
    className
  )}>
  <div class="flex items-center gap-4">
    {#if avatarUrl}
      <div
        class="relative h-12 w-12 shrink-0 animate-pulse overflow-hidden rounded-full border border-border-default bg-surface-card/60">
        <img
          src={avatarUrl}
          alt={name}
          loading="lazy"
          referrerpolicy="no-referrer"
          onload={e =>
            (
              e.currentTarget.closest('.animate-pulse') as HTMLElement | null
            )?.classList.remove('animate-pulse')}
          onerror={e => {
            const container = e.currentTarget.closest(
              '.animate-pulse'
            ) as HTMLElement | null
            container?.classList.remove('animate-pulse')
          }}
          class="h-full w-full object-cover shadow-xs" />
      </div>
    {:else}
      <div
        class="flex h-12 w-12 items-center justify-center rounded-full border border-border-default bg-surface-subtle text-base font-bold text-copilot">
        {name.charAt(0)}
      </div>
    {/if}

    <div class="flex flex-col">
      <h3 class="text-sm font-bold text-text-primary">{name}</h3>
      {#if role}
        <span class="text-xs font-medium text-text-muted">{role}</span>
      {/if}
    </div>
  </div>

  {#if bio}
    <p class="text-xs leading-relaxed text-text-secondary">{bio}</p>
  {/if}

  {#if actions}
    <div class="flex items-center gap-2 border-t border-border-subtle/40 pt-2">
      {@render actions()}
    </div>
  {/if}
</div>
