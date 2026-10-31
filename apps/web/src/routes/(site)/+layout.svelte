<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { onMount } from 'svelte';
    import { preloadCode } from '$app/navigation';
    import { SITE_SECTIONS } from '#app/siteSections.ts';

    let { children } = $props();

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

{@render children()}
