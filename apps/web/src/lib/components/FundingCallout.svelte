<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { ArrowRight, HeartHandshake } from '@lucide/svelte';
    import { Button } from '@idstead/ui';
    import { buttonKey } from '@idstead/ui/shortcuts.ts';
    import CalloutCard from './CalloutCard.svelte';

    let { visible, class: className = '' }: { visible: boolean; class?: string } = $props();
</script>

{#if visible}
    <CalloutCard
        icon={HeartHandshake}
        title="Support My Open Source Work"
        description="Your support helps keep my open source projects maintained and sustainable over time."
        class={className}>
        <Button
            type="primary"
            size="sm"
            href="/funding"
            keyboardShortcut={buttonKey('becomeSponsor')}
            shortcutLabel="Become a sponsor"
            class="w-full justify-center">
            Become a sponsor
            {#snippet trailing()}<ArrowRight
                    class="size-3"
                    strokeWidth={1.5}
                    aria-hidden="true" />{/snippet}
        </Button>
    </CalloutCard>
{/if}
