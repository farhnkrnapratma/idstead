<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { X, Search } from '@lucide/svelte';
    import EmptyState from '../EmptyState.svelte';
    import Button from '../Button.svelte';

    interface Props {
        title?: string;
        description?: string;
        onClearFilters?: () => void;
        clearLabel?: string;
        class?: string;
    }

    let {
        title = 'No results found',
        description = 'No items match the selected filters or search query.',
        onClearFilters = () => {},
        clearLabel = 'Clear filters',
        class: className = ''
    }: Props = $props();
</script>

<EmptyState
    icon={Search}
    {title}
    {description}
    class={className}>
    {#snippet actions()}
        <Button
            type="secondary"
            size="md"
            onclick={onClearFilters}>
            {#snippet leading()}
                <X class="size-3.5" />
            {/snippet}
            {clearLabel}
        </Button>
    {/snippet}
</EmptyState>
