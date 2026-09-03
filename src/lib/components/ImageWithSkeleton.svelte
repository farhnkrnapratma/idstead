<script lang="ts">
  import type {HTMLImgAttributes} from 'svelte/elements';
  import {Image as ImageIcon, User as UserIcon} from '@lucide/svelte';
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
    variant?: 'image' | 'avatar';
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
    variant = 'image',
    onload,
    onerror
  }: Props = $props();

  let isLoaded = $state(false);
  let isError = $state(false);
  let imgElement = $state<HTMLImageElement | null>(null);

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
      class="absolute inset-0 flex h-full w-full items-center justify-center bg-black/[0.04] p-1 text-text-muted select-none dark:bg-white/[0.05]">
      {#if isAvatar}
        <UserIcon
          class="size-1/2 text-copilot/50"
          aria-hidden="true" />
      {:else}
        <ImageIcon
          class="size-8 text-copilot/50"
          aria-hidden="true" />
      {/if}
    </div>
  {:else}
    {#if !isLoaded}
      <div
        class="absolute inset-0 flex h-full w-full animate-pulse bg-black/[0.06] dark:bg-white/[0.08]"
        aria-hidden="true">
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
