<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { LoadingState } from '@idstead/ui';

    onMount(() => {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        const target = new URL('/', window.location.origin);
        target.searchParams.set('tab', 'posts');
        target.searchParams.set('editPost', id || 'new');
        goto(`${target.pathname}${target.search}`, { replace: true });
    });
</script>

<main
    id="main"
    class="flex min-h-screen w-full items-center justify-center bg-canvas">
    <LoadingState
        variant="spinner"
        size="lg"
        label="Redirecting…" />
</main>
