<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { cn } from '@idstead/ui/utils/cn.ts';
    import { shortcut } from '@idstead/ui/utils/shortcut.svelte.ts';
    import { consentStore } from '../stores/consentStore.svelte';
    import type { SiteNavAction, SiteNavLink } from '../siteNavigation';

    interface Props {
        item: SiteNavLink | SiteNavAction;
        class?: string;
    }

    let { item, class: className = '' }: Props = $props();

    const linkClass = $derived(
        cn(
            'relative inline-flex shrink-0 cursor-pointer items-center text-left transition-colors hover:text-fg-accent rounded-xs focus-visible:text-fg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
            className
        )
    );
</script>

{#if 'action' in item}
    <button
        type="button"
        onclick={() => consentStore.openCustomizeModal()}
        use:shortcut={{ combo: item.combo, label: item.label }}
        class={linkClass}>
        {item.label}
    </button>
{:else}
    <a
        href={item.href}
        use:shortcut={{ combo: item.combo, label: item.label }}
        class={linkClass}>
        {item.label}
    </a>
{/if}
