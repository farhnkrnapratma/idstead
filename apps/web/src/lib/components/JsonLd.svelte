<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    interface Props {
        data: Record<string, unknown>;
    }

    let { data }: Props = $props();

    const script = $derived(
        `<script type="application/ld+json">${JSON.stringify(data)
            .replace(/</g, '\\u003c')
            .replace(/\u2028/g, '\\u2028')
            .replace(/\u2029/g, '\\u2029')}</` + 'script>'
    );
</script>

<svelte:head>
    {@html script}
</svelte:head>
