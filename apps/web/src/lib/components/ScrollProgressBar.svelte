<script lang="ts">
    import { scrollStore } from '@idstead/ui/stores/scrollStore.svelte.ts';

    const progress = $derived(Math.min(100, Math.max(0, scrollStore.progress)));
</script>

<div
    class="pointer-events-none absolute inset-x-0 -bottom-px h-0.5"
    role="progressbar"
    aria-label="Reading progress"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round(progress)}>
    <div
        class="h-full origin-left bg-accent transition-transform duration-150 ease-out motion-reduce:transition-none"
        style:transform="scaleX({progress / 100})">
    </div>
</div>
