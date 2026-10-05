<script lang="ts">
  import {resolve} from '$app/paths';
  import type {AdminNotificationRow} from '$lib/adminActivity';
  import {activityPageTitle} from '$lib/adminActivity';

  let {
    item,
    class: className = ''
  }: {item: AdminNotificationRow; class?: string} = $props();

  const title = $derived(activityPageTitle(item));
</script>

{#if item.page_url}
  <a
    href={resolve(...([item.page_url] as Parameters<typeof resolve>))}
    target="_blank"
    rel="noopener noreferrer"
    {title}
    class={`pointer-events-auto relative hover:text-accent hover:underline focus-visible:text-accent focus-visible:underline focus-visible:outline-2 focus-visible:outline-focus-ring ${className}`}
    onclick={event => event.stopPropagation()}>{title}</a>
{:else}<span class={className}>{title}</span>{/if}
