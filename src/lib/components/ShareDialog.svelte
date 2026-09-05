<script lang="ts">
  import {CopyCheck, Copy, QrCode} from '@lucide/svelte';
  import Dialog from './Dialog.svelte';
  import Button from './Button.svelte';

  interface Props {
    isOpen: boolean;
    title?: string;
    description?: string;
    url?: string;
    articleTitle?: string;
    showEmail?: boolean;
    showQrOption?: boolean;
    onOpenQr?: () => void;
    onClose: () => void;
    class?: string;
  }

  let {
    isOpen = $bindable(false),
    title = 'Share this Article',
    description = 'Copy the link or share it directly to social platforms.',
    url = typeof window !== 'undefined' ? window.location.href : '',
    articleTitle = '',
    showEmail = true,
    showQrOption = true,
    onOpenQr,
    onClose,
    class: className = ''
  }: Props = $props();

  let copied = $state(false);

  const effectiveUrl = $derived(
    url || (typeof window !== 'undefined' ? window.location.href : '')
  );
  const encodedUrl = $derived(encodeURIComponent(effectiveUrl));
  const encodedTitle = $derived(encodeURIComponent(articleTitle));

  function copyUrl() {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(effectiveUrl).then(() => {
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    });
  }

  function handleOpenQr() {
    onClose();
    onOpenQr?.();
  }
</script>

<Dialog
  bind:isOpen
  {title}
  {description}
  size="md"
  class={className}
  {onClose}>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-1.5">
      <span
        class="text-2xs font-semibold tracking-wider text-text-muted uppercase"
        >Direct link</span>
      <div
        class="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-base/80 p-1.5 pr-2 pl-3 shadow-2xs">
        <span
          class="min-w-0 flex-1 truncate font-mono text-xs text-text-secondary select-all">
          {effectiveUrl}
        </span>
        <Button
          type={copied ? 'tertiary' : 'secondary'}
          size="xs"
          class="size-6.5! shrink-0 px-0!"
          aria-label={copied ? 'Copied link' : 'Copy link'}
          onclick={copyUrl}>
          {#snippet leading()}
            {#if copied}
              <CopyCheck class="size-3.5 text-accent" />
            {:else}
              <Copy class="size-3.5" />
            {/if}
          {/snippet}
        </Button>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <span
        class="text-2xs font-semibold tracking-wider text-text-muted uppercase"
        >Share to platform</span>
      <div class="grid grid-cols-6 gap-1.5 sm:grid-cols-3 sm:gap-2">
        <Button
          href="https://x.com/intent/post?url={encodedUrl}&text={encodedTitle}"
          target="_blank"
          rel="noopener noreferrer"
          type="secondary"
          size="sm"
          class="w-full justify-center px-2 sm:px-2.5"
          title="Share on X"
          aria-label="Share on X (opens in a new tab)">
          {#snippet leading()}
            <i
              class="bi bi-twitter-x inline-flex size-4 shrink-0 items-center justify-center text-sm leading-none [&::before]:[vertical-align:0] [&::before]:leading-none"
              aria-hidden="true"></i>
          {/snippet}
          <span class="hidden truncate sm:inline">X</span>
        </Button>

        <Button
          href="https://linkedin.com/sharing/share-offsite/?url={encodedUrl}"
          target="_blank"
          rel="noopener noreferrer"
          type="secondary"
          size="sm"
          class="w-full justify-center px-2 sm:px-2.5"
          title="Share on LinkedIn"
          aria-label="Share on LinkedIn (opens in a new tab)">
          {#snippet leading()}
            <i
              class="bi bi-linkedin inline-flex size-4 shrink-0 items-center justify-center text-sm leading-none [&::before]:[vertical-align:0] [&::before]:leading-none"
              aria-hidden="true"></i>
          {/snippet}
          <span class="hidden truncate sm:inline">LinkedIn</span>
        </Button>

        <Button
          href="https://api.whatsapp.com/send?text={encodedTitle}%20{encodedUrl}"
          target="_blank"
          rel="noopener noreferrer"
          type="secondary"
          size="sm"
          class="w-full justify-center px-2 sm:px-2.5"
          title="Share on WhatsApp"
          aria-label="Share on WhatsApp (opens in a new tab)">
          {#snippet leading()}
            <i
              class="bi bi-whatsapp inline-flex size-4 shrink-0 items-center justify-center text-sm leading-none [&::before]:[vertical-align:0] [&::before]:leading-none"
              aria-hidden="true"></i>
          {/snippet}
          <span class="hidden truncate sm:inline">WhatsApp</span>
        </Button>

        <Button
          href="https://www.facebook.com/sharer/sharer.php?u={encodedUrl}"
          target="_blank"
          rel="noopener noreferrer"
          type="secondary"
          size="sm"
          class="w-full justify-center px-2 sm:px-2.5"
          title="Share on Facebook"
          aria-label="Share on Facebook (opens in a new tab)">
          {#snippet leading()}
            <i
              class="bi bi-facebook inline-flex size-4 shrink-0 items-center justify-center text-sm leading-none [&::before]:[vertical-align:0] [&::before]:leading-none"
              aria-hidden="true"></i>
          {/snippet}
          <span class="hidden truncate sm:inline">Facebook</span>
        </Button>

        <Button
          href="https://reddit.com/submit?url={encodedUrl}&title={encodedTitle}"
          target="_blank"
          rel="noopener noreferrer"
          type="secondary"
          size="sm"
          class="w-full justify-center px-2 sm:px-2.5"
          title="Share on Reddit"
          aria-label="Share on Reddit (opens in a new tab)">
          {#snippet leading()}
            <i
              class="bi bi-reddit inline-flex size-4 shrink-0 items-center justify-center text-sm leading-none [&::before]:[vertical-align:0] [&::before]:leading-none"
              aria-hidden="true"></i>
          {/snippet}
          <span class="hidden truncate sm:inline">Reddit</span>
        </Button>

        {#if showEmail}
          <Button
            href="mailto:?subject={encodedTitle}&body={encodedUrl}"
            type="secondary"
            size="sm"
            class="w-full justify-center px-2 sm:px-2.5"
            title="Share via Email"
            aria-label="Share via email">
            {#snippet leading()}
              <i
                class="bi bi-envelope-fill inline-flex size-4 shrink-0 items-center justify-center text-sm leading-none [&::before]:[vertical-align:0] [&::before]:leading-none"
                aria-hidden="true"></i>
            {/snippet}
            <span class="hidden truncate sm:inline">Email</span>
          </Button>
        {/if}
      </div>
    </div>

    {#if showQrOption && onOpenQr}
      <div class="border-t border-border-subtle/60 pt-2">
        <Button
          type="ghost"
          size="sm"
          class="w-full justify-center text-text-secondary hover:text-text-primary"
          onclick={handleOpenQr}>
          {#snippet leading()}
            <QrCode class="size-3.5" />
          {/snippet}
          <span>View QR Code</span>
        </Button>
      </div>
    {/if}
  </div>
</Dialog>
