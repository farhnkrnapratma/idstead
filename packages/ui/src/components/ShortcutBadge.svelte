<script lang="ts">
    import {
        KeySquare,
        Command,
        Option,
        ChevronUp,
        CornerDownLeft,
        ArrowRightToLine,
        ArrowBigUpDash
    } from '@lucide/svelte';
    import { cn } from '../utils/cn';
    import { shortcutKeyParts, keyLabel, type KeyIcon } from '../shortcuts.ts';
    import { platformStore } from '../stores/platformStore.svelte';
    import { KEY_GROUP_CLASS, KEY_SEGMENT_CLASS } from '../utils/shortcut.svelte';

    interface Props {
        combo: string;
        active?: boolean;
        leader?: boolean;
        class?: string;
    }

    let { combo, active = false, leader = false, class: className = '' }: Props = $props();

    const KEY_ICONS: Record<KeyIcon, typeof Command> = {
        Command,
        Option,
        ChevronUp,
        CornerDownLeft,
        ArrowRightToLine,
        ArrowBigUpDash
    };

    const labels = $derived(
        shortcutKeyParts(combo, platformStore.current).map(token =>
            keyLabel(token, platformStore.current)
        )
    );

    const spoken = $derived(
        [leader ? 'Leader' : '', ...labels.map(label => label.name)].filter(Boolean).join(' then ')
    );

    const tone = $derived(
        active ?
            'border-accent/30 bg-accent/25 text-fg-accent'
        :   'border-line-subtle bg-surface text-fg-secondary group-hover:border-accent group-hover:bg-accent/15 group-hover:text-fg-accent'
    );
</script>

<span class={cn('inline-flex shrink-0', className)}>
    <span class="sr-only">{spoken}</span>
    <span
        class={KEY_GROUP_CLASS}
        aria-hidden="true">
        {#if leader}
            <kbd class={cn(KEY_SEGMENT_CLASS, tone)}>
                <KeySquare class="size-2.5" />
            </kbd>
        {/if}
        {#each labels as label, index (`${index}-${label.text}`)}
            <kbd class={cn(KEY_SEGMENT_CLASS, tone)}>
                {#if label.icon}
                    {@const Icon = KEY_ICONS[label.icon]}
                    <Icon class="size-2.5" />
                {:else}
                    {label.text}
                {/if}
            </kbd>
        {/each}
    </span>
</span>
