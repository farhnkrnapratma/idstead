<script lang="ts">
  import {resolve} from '$app/paths';
  import {ChevronRight} from '@lucide/svelte';
  import ActivityTimestamp from './ActivityTimestamp.svelte';
  let {
    title,
    url = null,
    description,
    latest,
    expanded,
    onToggle,
    label = title
  }: {
    title: string;
    url?: string | null;
    description: string;
    latest: string;
    expanded: boolean;
    onToggle: () => void;
    label?: string;
  } = $props();
</script>

<div class="relative p-3">
  <button
    type="button"
    aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
    aria-expanded={expanded}
    onclick={onToggle}
    class="group absolute inset-0 flex cursor-pointer items-start rounded-md p-3 text-text-secondary transition-colors hover:bg-surface-hover hover:text-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring"
    ><ChevronRight
      class={`mt-0.5 size-4 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} /></button>
  <div class="pointer-events-none relative ml-6 min-w-0">
    <div class="text-xs font-bold break-words text-text-primary">
      {#if url}<a
          href={resolve(...([url] as Parameters<typeof resolve>))}
          target="_blank"
          rel="noopener noreferrer"
          class="pointer-events-auto underline decoration-border-strong underline-offset-2 hover:text-accent focus-visible:text-accent focus-visible:outline-2 focus-visible:outline-focus-ring"
          >{title}</a
        >{:else}{title}{/if}
    </div>
    <p class="mt-1 text-2xs break-words text-text-secondary">{description}</p>
    <ActivityTimestamp
      date={latest}
      class="mt-1 inline-block" />
  </div>
</div>
