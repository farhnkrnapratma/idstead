<script lang="ts">
    import type { Snippet } from 'svelte';
    import { cn } from '../utils/cn';

    interface Props {
        title?: string;
        description?: string;
        titleClass?: string;
        action?: string;
        method?: 'POST' | 'GET' | 'post' | 'get' | 'dialog' | 'DIALOG';
        onsubmit?: (e: SubmitEvent) => void;
        class?: string;
        bare?: boolean;
        children?: Snippet;
        headerActions?: Snippet;
        actions?: Snippet;
    }

    let {
        title = '',
        description = '',
        titleClass = 'type-section-title',
        action = '',
        method = 'POST',
        onsubmit,
        class: className = '',
        bare = false,
        children,
        headerActions,
        actions
    }: Props = $props();
    function handleSubmit(e: SubmitEvent) {
        if (onsubmit) {
            e.preventDefault();
            onsubmit(e);
        }
    }
</script>

<form
    {action}
    {method}
    onsubmit={handleSubmit}
    novalidate
    class={cn(
        'flex flex-col gap-4 sm:gap-6',
        bare ? '' : 'rounded-md glass-card p-3.5 sm:p-6',
        className
    )}
    autocomplete="off">
    {#if title || description || headerActions}
        <div class="flex items-start justify-between gap-3 sm:items-center sm:gap-4">
            <div class="min-w-0 flex-1 select-none">
                {#if title}
                    <h2 class={titleClass}>{title}</h2>
                {/if}
                {#if description}
                    <p class="mt-1 text-xs text-text-secondary">{description}</p>
                {/if}
            </div>
            {#if headerActions}
                <div class="flex shrink-0 items-center">
                    {@render headerActions()}
                </div>
            {/if}
        </div>
    {/if}

    {@render children?.()}

    {@render actions?.()}
</form>
