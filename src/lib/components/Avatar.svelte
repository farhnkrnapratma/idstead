<script lang="ts">
    import { Blobatar } from '@blobatar/svelte';
    import { cn } from '../utils/cn';

    let {
        name,
        src = '',
        alt,
        class: className = ''
    }: { name: string; src?: string | null; alt?: string; class?: string } = $props();

    let failedSource = $state<string | null>(null);
    const description = $derived(alt?.trim() || `Profile picture of ${name}`);
</script>

<span class={cn('inline-flex size-7 shrink-0 items-center justify-center', className)}>
    {#if src && src !== failedSource}
        <img
            {src}
            alt={description}
            class="size-full rounded-full object-cover"
            onerror={() => (failedSource = src ?? null)} />
    {:else}
        <Blobatar
            {name}
            alt={description}
            background={false}
            class="size-full scale-125" />
    {/if}
</span>
