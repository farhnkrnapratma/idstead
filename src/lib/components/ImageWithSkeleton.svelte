<script lang="ts">
  import type {HTMLImgAttributes} from 'svelte/elements';
  import {Image as ImageIcon} from '@lucide/svelte';
  import {cn} from '../utils/cn';

  interface Props {
    src?: string | null;
    alt: string;
    class?: string;
    imgClass?: string;
    loading?: 'lazy' | 'eager';
    referrerpolicy?: HTMLImgAttributes['referrerpolicy'];
    aspectRatio?: string;
    rounded?: string;
    onload?: () => void;
    onerror?: () => void;
  }

  let {
    src = '',
    alt,
    class: className = '',
    imgClass = '',
    loading = 'lazy',
    referrerpolicy,
    aspectRatio,
    rounded = 'rounded-sm',
    onload,
    onerror
  }: Props = $props();

  let isLoaded = $state(false);
  let isError = $state(false);
  let imgElement = $state<HTMLImageElement | null>(null);

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
    isError = true;
    isLoaded = true;
    onerror?.();
  }
</script>

<div
  class={cn(
    '@container relative overflow-hidden bg-gh-gray-1 select-none dark:bg-gh-gray-6',
    rounded,
    aspectRatio,
    className
  )}>
  {#if isError || !src}
    <div
      class="absolute inset-0 flex h-full w-full items-center justify-center bg-gh-gray-2 p-1 text-text-muted select-none dark:bg-gh-gray-5">
      <ImageIcon
        class="size-8 text-copilot/50"
        aria-hidden="true" />
    </div>
  {:else}
    {#if !isLoaded}
      <div
        class="absolute inset-0 flex h-full w-full animate-pulse items-center justify-center border border-border-subtle/40 bg-gh-gray-2 dark:bg-gh-gray-5"
        aria-hidden="true">
        <ImageIcon
          class="size-8 text-text-muted/40 dark:text-text-muted/30"
          aria-hidden="true" />
      </div>
    {/if}
    <img
      bind:this={imgElement}
      src={src || ''}
      {alt}
      {loading}
      {referrerpolicy}
      onload={handleLoad}
      onerror={handleError}
      class={cn(
        'block h-full w-full object-cover',
        !isLoaded && 'pointer-events-none invisible absolute inset-0 opacity-0',
        imgClass
      )} />
  {/if}
</div>
