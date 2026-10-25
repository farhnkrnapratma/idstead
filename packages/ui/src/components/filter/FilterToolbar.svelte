<script lang="ts">
    import { setContext, type Snippet } from 'svelte';
    import { cn } from '../../utils/cn';
    import {
        FILTER_TOOLBAR_CONTROL_SIZE,
        type FilterToolbarControlSize
    } from './filterToolbarContext';

    interface Props {
        title?: string;
        controlSize?: FilterToolbarControlSize;
        embedded?: boolean;
        searchSlot?: Snippet;
        filterControlsSlot?: Snippet;
        sortSlot?: Snippet;
        chipsSlot?: Snippet;
        countSlot?: Snippet;
        class?: string;
    }

    let {
        title = '',
        controlSize = 'md',
        embedded = false,
        searchSlot,
        filterControlsSlot,
        sortSlot,
        chipsSlot,
        countSlot,
        class: className = ''
    }: Props = $props();

    setContext(FILTER_TOOLBAR_CONTROL_SIZE, {
        get controlSize() {
            return controlSize;
        },
        get stackOnMobile() {
            return true;
        }
    });
</script>

<div
    role="region"
    aria-label={title || 'Filter and sort options'}
    class={cn(
        'relative z-20 flex flex-col gap-2.5 select-none',
        embedded ? 'border-b border-line-subtle px-4 pb-3' : 'rounded-md glass-card p-3 sm:p-4',
        className
    )}>
    <div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-nowrap sm:items-center">
        {#if searchSlot}
            <div class="min-w-0 flex-1 sm:min-w-20 sm:flex-[1_0_5rem]">
                {@render searchSlot()}
            </div>
        {/if}
        <div class="flex min-w-0 items-center justify-between gap-2 overflow-x-auto sm:contents">
            {#if filterControlsSlot}
                <div
                    class={cn(
                        'flex min-w-0 items-center gap-2 sm:contents',
                        sortSlot ? 'flex-initial' : 'flex-1'
                    )}>
                    {@render filterControlsSlot()}
                </div>
            {/if}
            {#if sortSlot}
                <div class="min-w-0 flex-1 sm:contents">
                    {@render sortSlot()}
                </div>
            {/if}
        </div>
    </div>

    {#if countSlot}
        {@render countSlot()}
    {/if}

    {#if chipsSlot}
        {@render chipsSlot()}
    {/if}
</div>
