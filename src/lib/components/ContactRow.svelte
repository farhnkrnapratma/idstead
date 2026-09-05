<script lang="ts">
  import type {Snippet} from 'svelte';
  import {Copy, CopyCheck} from '@lucide/svelte';
  import {cn} from '../utils/cn';
  import Button from './Button.svelte';

  interface Props {
    title: string;
    subtitle?: string;
    href?: string;
    copyableText?: string;
    class?: string;
    trailing?: Snippet;
  }

  let {
    title,
    subtitle = '',
    href = '',
    copyableText = '',
    class: className = '',
    trailing
  }: Props = $props();

  let copied = $state(false);

  function handleCopy() {
    if (!copyableText || typeof window === 'undefined') return;
    navigator.clipboard.writeText(copyableText).then(() => {
      copied = true;
      setTimeout(() => (copied = false), 2000);
    });
  }
</script>

<div
  class={cn(
    'group flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface/40 px-3.5 py-2.5 transition-all duration-300 hover:border-border-strong hover:bg-surface-hover',
    className
  )}>
  <div class="flex min-w-0 flex-col">
    {#if href}
      <a
        {href}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
        class="truncate text-xs font-bold text-text-primary transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
        {title}
      </a>
    {:else}
      <span class="truncate text-xs font-bold text-text-primary">{title}</span>
    {/if}
    {#if subtitle}
      <span class="truncate text-xxs text-text-muted">{subtitle}</span>
    {/if}
  </div>

  <div class="flex shrink-0 items-center gap-2">
    {#if copyableText}
      <Button
        type="secondary"
        size="sm"
        onclick={handleCopy}
        aria-label="Copy contact information">
        {#if copied}
          <CopyCheck class="size-3.5 text-accent" />
          <span class="text-accent">Copied</span>
        {:else}
          <Copy class="size-3.5" />
          <span>Copy</span>
        {/if}
      </Button>
    {/if}

    {#if trailing}
      {@render trailing()}
    {/if}
  </div>
</div>
