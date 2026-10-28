<script lang="ts">
    import { page } from '$app/state';
    import { publicHref, publicSiteUrl } from '#app/publicSite.ts';
    import type { AdminNotificationRow } from '#lib/adminActivity.ts';
    import { activityPageTitle } from '#lib/adminActivity.ts';

    let { item, class: className = '' }: { item: AdminNotificationRow; class?: string } = $props();

    const title = $derived(activityPageTitle(item));
    const href = $derived(item.page_url ? publicHref(publicSiteUrl(page.data), item.page_url) : '');
</script>

{#if item.page_url}
    <a
        {href}
        target="_blank"
        rel="noopener noreferrer"
        {title}
        class={`pointer-events-auto relative underline decoration-fg-muted underline-offset-2 hover:text-fg-accent hover:decoration-current focus-visible:text-fg-accent focus-visible:outline-2 focus-visible:outline-focus-ring ${className}`}
        onclick={event => event.stopPropagation()}>{title}</a>
{:else}<span class={className}>{title}</span>{/if}
