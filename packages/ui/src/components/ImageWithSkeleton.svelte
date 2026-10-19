<script lang="ts">
    import type { HTMLImgAttributes } from 'svelte/elements';
    import type { ImageSource } from '../types';
    import { Image as ImageIcon, User as UserIcon } from '@lucide/svelte';
    import { cn } from '../utils/cn';

    interface Props {
        src?: string | null;
        alt: string;
        sources?: ImageSource[];
        class?: string;
        imgClass?: string;
        loading?: 'lazy' | 'eager';
        fetchpriority?: 'high' | 'low' | 'auto';
        referrerpolicy?: HTMLImgAttributes['referrerpolicy'];
        aspectRatio?: string;
        rounded?: string;
        variant?: 'image' | 'avatar';
        onload?: () => void;
        onerror?: () => void;
    }

    let {
        src = '',
        alt,
        sources,
        class: className = '',
        imgClass = '',
        loading = 'lazy',
        fetchpriority,
        referrerpolicy,
        aspectRatio,
        rounded = 'rounded-md',
        variant = 'image',
        onload,
        onerror
    }: Props = $props();

    let isLoaded = $state(false);
    let isError = $state(false);
    let imgElement = $state<HTMLImageElement | null>(null);
    let sourcesFailed = $state(false);

    const useSources = $derived(Boolean(sources?.length) && !sourcesFailed);

    let isAvatar = $derived(
        variant === 'avatar' || Boolean(rounded && rounded.includes('rounded-full'))
    );

    $effect(() => {
        if (!src) {
            isLoaded = false;
            isError = true;
            return;
        }

        isError = false;

        if (imgElement && imgElement.complete && imgElement.naturalWidth > 0) {
            isLoaded = true;
            onload?.();
        }
    });

    function handleLoad() {
        isLoaded = true;
        onload?.();
    }

    function handleError() {
        if (useSources) {
            sourcesFailed = true;
            return;
        }
        isError = true;
        isLoaded = true;
        onerror?.();
    }
</script>

<div
    class={cn(
        '@container relative overflow-hidden bg-surface-card select-none',
        rounded,
        aspectRatio,
        className
    )}>
    {#if isError || !src}
        <div
            class="absolute inset-0 flex h-full w-full items-center justify-center bg-black/4 p-1 text-text-muted select-none dark:bg-white/5">
            {#if isAvatar}
                <UserIcon
                    class="size-1/2 text-text-muted"
                    aria-hidden="true" />
            {:else}
                <ImageIcon
                    class="size-8 text-text-muted"
                    aria-hidden="true" />
            {/if}
        </div>
    {:else}
        {#if !isLoaded}
            <div
                class="absolute inset-0 flex h-full w-full animate-pulse bg-black/6 dark:bg-white/8"
                aria-hidden="true">
            </div>
        {/if}
        {#if useSources}
            <picture>
                {#each sources ?? [] as source (source.type)}
                    <source
                        srcset={source.srcset}
                        type={source.type} />
                {/each}
                <img
                    bind:this={imgElement}
                    src={src || ''}
                    {alt}
                    {loading}
                    {fetchpriority}
                    {referrerpolicy}
                    onload={handleLoad}
                    onerror={handleError}
                    class={cn('relative block h-full w-full object-cover', imgClass)} />
            </picture>
        {:else}
            <img
                bind:this={imgElement}
                src={src || ''}
                {alt}
                {loading}
                {fetchpriority}
                {referrerpolicy}
                onload={handleLoad}
                onerror={handleError}
                class={cn('relative block h-full w-full object-cover', imgClass)} />
        {/if}
    {/if}
</div>
