<script lang="ts">
    import { Info } from '@lucide/svelte';
    import Tooltip from './Tooltip.svelte';

    let { label, context }: { label: string; context?: string } = $props();
</script>

<div class="flex items-center gap-1 px-2 pb-1">
    <h3 class="text-2xs font-semibold tracking-wider text-fg-muted uppercase">{label}</h3>
    {#if context}
        <Tooltip
            content={context}
            align="left"
            class="z-100001 max-w-64 leading-relaxed wrap-anywhere whitespace-normal!">
            <button
                type="button"
                aria-label={`${label}: ${context}`}
                class="inline-flex size-5 shrink-0 cursor-help items-center justify-center rounded-sm text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-focus-ring">
                <Info
                    class="size-3.5"
                    aria-hidden="true" />
            </button>
        </Tooltip>
    {/if}
</div>
