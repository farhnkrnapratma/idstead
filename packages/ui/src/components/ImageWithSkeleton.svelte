<script lang="ts">
    import { untrack } from 'svelte';
    import type { Attachment } from 'svelte/attachments';
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

    let loadedSrc = $state<string | null>(null);
    let failedSrc = $state<string | null>(null);
    let sourcesFailed = $state(false);

    const isError = $derived(!src || failedSrc === src);
    const isLoaded = $derived(!!src && (loadedSrc === src || failedSrc === src));
    const useSources = $derived(Boolean(sources?.length) && !sourcesFailed);

    let isAvatar = $derived(
        variant === 'avatar' || Boolean(rounded && rounded.includes('rounded-full'))
    );

    function handleLoad() {
        loadedSrc = src ?? null;
        onload?.();
    }

    function handleError() {
        if (useSources) {
            sourcesFailed = true;
            return;
        }
        failedSrc = src ?? null;
        onerror?.();
    }

    const loadedBeforeHydration: Attachment<HTMLImageElement> = image => {
        untrack(() => {
            if (image.complete && image.naturalWidth > 0 && loadedSrc !== src) handleLoad();
        });
    };
</script>

<div
    class={cn(
        '@container relative overflow-hidden bg-surface select-none',
        rounded,
        aspectRatio,
        className
    )}>
    {#if isError || !src}
        <div
            class="absolute inset-0 flex h-full w-full items-center justify-center bg-fg/4 p-1 text-fg-muted select-none dark:bg-fg/5">
            {#if isAvatar}
                <UserIcon
                    class="size-1/2 text-fg-muted"
                    aria-hidden="true" />
            {:else}
                <ImageIcon
                    class="size-8 text-fg-muted"
                    aria-hidden="true" />
            {/if}
        </div>
    {:else}
        {#if !isLoaded}
            <div
                class="absolute inset-0 flex h-full w-full animate-pulse bg-fg/6 dark:bg-fg/8"
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
                    {@attach loadedBeforeHydration}
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
                {@attach loadedBeforeHydration}
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
