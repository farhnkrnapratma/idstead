<script lang="ts">
  import type {Snippet} from 'svelte';
  import {ArrowUpRight} from '@lucide/svelte';
  import {cn} from '../utils/cn';

  interface Props {
    title: string;
    href?: string;
    description?: string;
    interactive?: boolean;
    class?: string;
    meta?: Snippet;
    tags?: Snippet;
    actions?: Snippet;
    children?: Snippet;
  }

  let {
    title,
    href = '',
    description = '',
    interactive = true,
    class: className = '',
    meta,
    tags,
    actions,
    children
  }: Props = $props();
</script>

<div
  class={cn(
    'group relative flex flex-col justify-between rounded-sm glass-card p-5 sm:p-6',
    className
  )}>
  <div class="flex flex-col gap-2">
    <div class="flex items-start justify-between gap-3">
      <h3
        class="font-sans-title text-base font-bold tracking-tight text-text-primary transition-colors group-hover:text-copilot">
        {#if href}
          <a
            {href}
            class="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
            {title}
          </a>
        {:else}
          {title}
        {/if}
      </h3>
      {#if href && interactive}
        <ArrowUpRight
          class="mt-1 size-3.5 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-copilot" />
      {/if}
    </div>

    {#if meta}
      <div class="text-xs text-text-muted select-none">
        {@render meta()}
      </div>
    {/if}

    {#if description}
      <p class="mt-1 line-clamp-3 text-xs leading-relaxed text-text-secondary">
        {description}
      </p>
    {/if}

    {#if children}
      {@render children()}
    {/if}
  </div>

  {#if tags || actions}
    <div
      class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle/40 pt-3 select-none">
      {#if tags}
        <div class="flex flex-wrap items-center gap-1.5">
          {@render tags()}
        </div>
      {/if}

      {#if actions}
        <div class="ml-auto flex items-center gap-2">
          {@render actions()}
        </div>
      {/if}
    </div>
  {/if}
</div>
