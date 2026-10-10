<script lang="ts">
    import { Trash } from '@lucide/svelte';
    import FilterChip from './FilterChip.svelte';
    import Button from '../Button.svelte';
    import { cn } from '../../utils/cn';
    import { buttonKey } from '#lib/shortcuts.ts';

    interface ChipItem {
        id: string;
        type: string;
        value: string;
        label: string;
    }

    interface Props {
        chips: ChipItem[];
        onRemove?: (type: string, value: string) => void;
        onClearAll?: () => void;
        clearAllLabel?: string;
        class?: string;
    }

    let {
        chips = [],
        onRemove = () => {},
        onClearAll = () => {},
        clearAllLabel = 'Clear',
        class: className = ''
    }: Props = $props();
</script>

{#if chips.length > 0}
    <div
        class={cn('flex w-full flex-wrap items-center gap-1.5 pt-2 select-none', className)}
        role="region"
        aria-label="Active filters">
        {#each chips as chip (chip.id)}
            <FilterChip
                label={chip.type}
                value={chip.value}
                class="max-w-full"
                onRemove={() => onRemove(chip.type, chip.value)} />
        {/each}

        <Button
            type="danger"
            size="xs"
            onclick={onClearAll}
            keyboardShortcut={buttonKey('clearFilters')}
            shortcutLabel="Clear filters"
            class="h-auto shrink-0 gap-1 rounded-full px-2 py-1 text-xs whitespace-nowrap">
            {#snippet leading()}<Trash class="size-3" />{/snippet}
            {clearAllLabel}
        </Button>
    </div>
{/if}
