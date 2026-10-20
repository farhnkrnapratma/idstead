<script lang="ts">
    import { onMount } from 'svelte';
    import { preloadCode } from '$app/navigation';
    import SkipLink from '@idstead/ui/components/SkipLink.svelte';
    import SiteNav from '#app/components/SiteNav.svelte';
    import { SITE_SECTIONS } from '#app/siteSections.ts';

    let { data, children } = $props();

    onMount(() => {
        const preload = () => {
            for (const section of SITE_SECTIONS) void preloadCode(section.routeId);
        };
        if ('requestIdleCallback' in window) {
            const handle = requestIdleCallback(preload, { timeout: 3000 });
            return () => cancelIdleCallback(handle);
        }
        const timer = setTimeout(preload, 1500);
        return () => clearTimeout(timer);
    });
</script>

<SkipLink />

<SiteNav projects={data.projects} />

{@render children()}
