<script lang="ts">
  import type {Snippet} from 'svelte';
  import {cn} from '../utils/cn';

  import ImageWithSkeleton from './ImageWithSkeleton.svelte';

  interface Props {
    name: string;
    role?: string;
    avatarUrl?: string;
    bio?: string;
    class?: string;
    actions?: Snippet;
  }

  let {
    name,
    role = '',
    avatarUrl = '',
    bio = '',
    class: className = '',
    actions
  }: Props = $props();
</script>

<div
  class={cn(
    'flex flex-col gap-4 rounded-md glass-card p-5 select-none sm:p-6',
    className
  )}>
  <div class="flex items-center gap-4">
    {#if avatarUrl}
      <ImageWithSkeleton
        src={avatarUrl}
        alt={name}
        referrerpolicy="no-referrer"
        rounded="rounded-full"
        class="h-12 w-12 shrink-0 border border-border-subtle/40 shadow-2xs" />
    {:else}
      <div
        class="flex h-12 w-12 items-center justify-center rounded-full border border-border-subtle/40 bg-surface-subtle text-base font-bold text-accent shadow-2xs">
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
