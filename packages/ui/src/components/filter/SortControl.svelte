<script lang="ts">
    import { getContext } from 'svelte';
    import { ArrowUpNarrowWide, ArrowDownWideNarrow } from '@lucide/svelte';
    import { cn } from '../../utils/cn';
    import { buttonKey } from '../../shortcuts.ts';
    import Dropdown from '../Dropdown.svelte';
    import IconButton from '../IconButton.svelte';
    import { FILTER_TOOLBAR_CONTROL_SIZE, type FilterToolbarContext } from './filterToolbarContext';

    interface SortOption {
        value: string;
        label: string;
    }

    interface Props {
        fields: SortOption[];
        currentField: string;
        currentDirection: 'asc' | 'desc';
        onFieldChange?: (field: string) => void;
        onDirectionToggle?: () => void;
        size?: 'sm' | 'md';
        labelPrefix?: string;
        fullWidth?: boolean;
        class?: string;
    }

    let {
        fields,
        currentField,
        currentDirection,
        onFieldChange,
        onDirectionToggle,
        size,
        labelPrefix = 'Sort by',
        fullWidth = false,
        class: className = ''
    }: Props = $props();

    let currentFieldOption = $derived(fields.find(f => f.value === currentField) ?? fields[0]);

    const filterToolbar = getContext<FilterToolbarContext | undefined>(FILTER_TOOLBAR_CONTROL_SIZE);
    const resolvedSize = $derived(filterToolbar?.controlSize ?? size ?? 'md');
    const stackOnMobile = $derived(!fullWidth && (filterToolbar?.stackOnMobile ?? false));
</script>

<div
    class={cn(
        'flex min-w-0 items-center gap-1.5',
        fullWidth ? 'w-full'
        : stackOnMobile ? 'w-full sm:w-max sm:max-w-full'
        : 'w-max max-w-full',
        className
    )}>
    <Dropdown
        label={labelPrefix}
        options={fields}
        value={currentFieldOption?.value}
        size={resolvedSize}
        {fullWidth}
        class={fullWidth || stackOnMobile ? 'min-w-0 flex-1' : 'min-w-0'}
        onChange={value => onFieldChange?.(value)} />

    <IconButton
        ariaLabel="Sort direction: {currentDirection === 'asc' ? 'Ascending' : 'Descending'}"
        tooltip={currentDirection === 'asc' ? 'Sort: Ascending' : 'Sort: Descending'}
        size={resolvedSize}
        onclick={onDirectionToggle}
        keyboardShortcut={buttonKey('sortDirection')}
        shortcutLabel="Sort direction"
        class="shrink-0 text-text-secondary hover:text-accent-text">
        {#if currentDirection === 'asc'}
            <ArrowUpNarrowWide class="size-4" />
        {:else}
            <ArrowDownWideNarrow class="size-4" />
        {/if}
    </IconButton>
</div>
