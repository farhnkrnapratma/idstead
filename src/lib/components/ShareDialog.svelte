<script lang="ts">
  import {Check, Copy, SquareArrowOutUpRight} from '@lucide/svelte';
  import Dialog from './Dialog.svelte';
  import Button from './Button.svelte';

  interface Props {
    isOpen: boolean;
    title?: string;
    url?: string;
    articleTitle?: string;
    showEmail?: boolean;
    onClose: () => void;
    class?: string;
  }

  let {
    isOpen = $bindable(false),
    title = 'Share this Article',
    url = typeof window !== 'undefined' ? window.location.href : '',
    articleTitle = '',
    showEmail = false,
    onClose,
    class: className = ''
  }: Props = $props();

  let copied = $state(false);

  function copyUrl() {
    if (typeof window === 'undefined') return;
    const targetUrl = url || window.location.href;
    navigator.clipboard.writeText(targetUrl).then(() => {
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2500);
    });
  }

  const encodedUrl = $derived(
    encodeURIComponent(
      url || (typeof window !== 'undefined' ? window.location.href : '')
    )
  );
  const encodedTitle = $derived(encodeURIComponent(articleTitle));
</script>

<Dialog
  bind:isOpen
  {title}
  description="Copy the article link or share it directly to social platforms."
  size="md"
  class={className}
  {onClose}>
  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
    <Button
      type={copied ? 'tertiary' : 'secondary'}
      size="md"
      class="w-full justify-center"
      onclick={copyUrl}>
      {#snippet leading()}
        {#if copied}
          <Check class="size-3.5 text-copilot" />
        {:else}
          <Copy class="size-3.5" />
        {/if}
      {/snippet}
      {copied ? 'Copied!' : 'Copy URL'}
    </Button>

    <Button
      href="https://x.com/intent/post?url={encodedUrl}&text={encodedTitle}"
      target="_blank"
      rel="noopener noreferrer"
      type="secondary"
      size="md"
      class="w-full justify-between px-3"
      aria-label="Share on X (opens in a new tab)">
      <span>X</span>
      {#snippet trailing()}
        <SquareArrowOutUpRight class="size-3.5 text-text-muted" />
      {/snippet}
    </Button>

    <Button
      href="https://linkedin.com/sharing/share-offsite/?url={encodedUrl}"
      target="_blank"
      rel="noopener noreferrer"
      type="secondary"
      size="md"
      class="w-full justify-between px-3"
      aria-label="Share on LinkedIn (opens in a new tab)">
      <span>LinkedIn</span>
      {#snippet trailing()}
        <SquareArrowOutUpRight class="size-3.5 text-text-muted" />
      {/snippet}
    </Button>

    <Button
      href="https://www.facebook.com/sharer/sharer.php?u={encodedUrl}"
      target="_blank"
      rel="noopener noreferrer"
      type="secondary"
      size="md"
      class="w-full justify-between px-3"
      aria-label="Share on Facebook (opens in a new tab)">
      <span>Facebook</span>
      {#snippet trailing()}
        <SquareArrowOutUpRight class="size-3.5 text-text-muted" />
      {/snippet}
    </Button>

    <Button
      href="https://reddit.com/submit?url={encodedUrl}&title={encodedTitle}"
      target="_blank"
      rel="noopener noreferrer"
      type="secondary"
      size="md"
      class="w-full justify-between px-3"
      aria-label="Share on Reddit (opens in a new tab)">
      <span>Reddit</span>
      {#snippet trailing()}
        <SquareArrowOutUpRight class="size-3.5 text-text-muted" />
      {/snippet}
    </Button>

    {#if showEmail}
      <Button
        href="mailto:?subject={encodedTitle}&body={encodedUrl}"
        type="secondary"
        size="md"
        class="w-full justify-between px-3"
        aria-label="Share via email">
        <span>Email</span>
        {#snippet trailing()}
          <SquareArrowOutUpRight class="size-3.5 text-text-muted" />
        {/snippet}
      </Button>
    {/if}
  </div>

  {#snippet footer()}
    <Button
      type="secondary"
      size="md"
      onclick={onClose}>
      <span class="inline-flex items-center gap-1.5">
        <span>Close</span>
        <kbd
          class="hidden items-center rounded-sm border border-border-subtle/80 bg-surface-elevated/80 px-1 py-0.5 font-mono text-3xs leading-none text-text-muted select-none sm:inline-flex">
          Esc
        </kbd>
      </span>
    </Button>
  {/snippet}
</Dialog>
