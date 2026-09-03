<script lang="ts">
  import {
    Copy,
    CopyCheck,
    Link,
    EllipsisVertical,
    Hash,
    ScanText,
    TextAlignStart,
    FileText
  } from '@lucide/svelte';
  import {toastStore} from '../stores/toastStore.svelte';
  import {markdownToPlainText} from '../utils/markdownToText';
  import {cn} from '../utils/cn';
  import Button from './Button.svelte';

  interface Props {
    variant?: 'inline' | 'sidebar' | 'toolbar';
    slug: string;
    pageId?: string | null;
    title?: string;
    markdownContent?: string;
    viewMarkdownUrl: string;
    viewTextUrl: string;
    pageUrl?: string;
    avatarUrl?: string;
    showToolbar?: boolean;
    class?: string;
  }

  let {
    variant = 'inline',
    slug,
    pageId = null,
    title = '',
    markdownContent,
    viewMarkdownUrl,
    viewTextUrl,
    pageUrl,
    avatarUrl = '',
    showToolbar = true,
    class: className = ''
  }: Props = $props();

  let isMoreOpen = $state(false);
  let moreContainerRef: HTMLDivElement | undefined = $state();
  let cachedMarkdown = $state<string | null>(null);

  let copiedMarkdown = $state(false);
  let copiedText = $state(false);
  let copiedUrl = $state(false);
  let copiedId = $state(false);

  function handleWindowPointerDown(e: PointerEvent) {
    if (
      isMoreOpen
      && moreContainerRef
      && !moreContainerRef.contains(e.target as Node)
    ) {
      isMoreOpen = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isMoreOpen) {
      isMoreOpen = false;
    }
  }

  function handleWindowScroll() {
    if (isMoreOpen) isMoreOpen = false;
  }

  function toggleMore() {
    isMoreOpen = !isMoreOpen;
  }

  async function getMarkdown(): Promise<string> {
    if (markdownContent) return markdownContent;
    if (cachedMarkdown) return cachedMarkdown;
    const res = await fetch(viewMarkdownUrl);
    if (!res.ok) throw new Error('Failed to fetch Markdown');
    const text = await res.text();
    cachedMarkdown = text;
    return text;
  }

  async function getPlainText(): Promise<string> {
    const md = await getMarkdown();
    return markdownToPlainText(md);
  }

  async function handleCopyMarkdown() {
    try {
      const md = await getMarkdown();
      await navigator.clipboard.writeText(md);
      copiedMarkdown = true;
      toastStore.success('Markdown copied to clipboard');
      setTimeout(() => {
        copiedMarkdown = false;
      }, 2000);
    } catch {
      toastStore.error('Failed to copy Markdown');
    }
  }

  async function handleCopyPlainText() {
    try {
      const plainText = await getPlainText();
      const headerTitle = title ? `${title}\n\n` : '';
      await navigator.clipboard.writeText(`${headerTitle}${plainText}`);
      copiedText = true;
      toastStore.success('Text copied to clipboard');
      setTimeout(() => {
        copiedText = false;
      }, 2000);
    } catch {
      toastStore.error('Failed to copy Text');
    }
  }

  async function handleCopyPageUrl() {
    try {
      const url =
        pageUrl || (typeof window !== 'undefined' ? window.location.href : '');
      await navigator.clipboard.writeText(url);
      copiedUrl = true;
      toastStore.success('Page URL copied to clipboard');
      setTimeout(() => {
        copiedUrl = false;
      }, 2000);
    } catch {
      toastStore.error('Failed to copy URL');
    }
  }

  async function handleCopyPageId() {
    if (!pageId) return;
    try {
      await navigator.clipboard.writeText(pageId);
      copiedId = true;
      toastStore.success('Page ID copied to clipboard');
      setTimeout(() => {
        copiedId = false;
      }, 2000);
    } catch {
      toastStore.error('Failed to copy Page ID');
    }
  }

  function downloadFile(filename: string, content: string, mimeType: string) {
    if (typeof window === 'undefined') return;
    const blob = new Blob([content], {type: mimeType});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleSaveMarkdown() {
    try {
      const md = await getMarkdown();
      const filename = `${slug || 'document'}.md`;
      downloadFile(filename, md, 'text/markdown;charset=utf-8');
      toastStore.success('Markdown file downloaded');
    } catch {
      toastStore.error('Failed to download Markdown');
    }
  }

  async function handleSaveText() {
    try {
      const plainText = await getPlainText();
      const headerTitle = title ? `${title}\n\n` : '';
      const filename = `${slug || 'document'}.txt`;
      downloadFile(
        filename,
        `${headerTitle}${plainText}`,
        'text/plain;charset=utf-8'
      );
      toastStore.success('Text file downloaded');
    } catch {
      toastStore.error('Failed to download Text file');
    }
  }
</script>

<svelte:window
  onpointerdown={handleWindowPointerDown}
  onkeydown={handleKeydown}
  onscroll={handleWindowScroll} />

{#snippet popoverMenu()}
  <div
    role="menu"
    class="absolute top-full right-0 left-auto z-50 mt-1.5 flex max-w-[calc(100vw-2rem)] flex-col gap-2.5 rounded-sm border border-border-subtle bg-surface-elevated/95 p-2.5 shadow-xl backdrop-blur-md sm:flex-row sm:gap-0 sm:divide-x sm:divide-border-subtle/60">
    <div class="flex flex-col gap-1 sm:pr-3">
      <span
        class="px-1.5 text-2xs font-semibold tracking-wider text-text-muted uppercase"
        >Copy</span>
      <Button
        type="ghost"
        size="xs"
        class="w-full justify-start px-1.5 whitespace-nowrap sm:hidden"
        onclick={() => {
          isMoreOpen = false;
          handleCopyPageUrl();
        }}>
        {#snippet leading()}
          {#if copiedUrl}
            <CopyCheck class="size-3.5 text-copilot" />
          {:else}
            <Link class="size-3.5" />
          {/if}
        {/snippet}
        <span>{copiedUrl ? 'Copied URL!' : 'Copy URL'}</span>
      </Button>
      <Button
        type="ghost"
        size="xs"
        class="w-full justify-start px-1.5 whitespace-nowrap"
        onclick={() => {
          isMoreOpen = false;
          handleCopyPlainText();
        }}>
        {#snippet leading()}
          {#if copiedText}
            <CopyCheck class="size-3.5 text-copilot" />
          {:else}
            <ScanText class="size-3.5" />
          {/if}
        {/snippet}
        <span>{copiedText ? 'Copied Text!' : 'Copy as Text'}</span>
      </Button>
      {#if pageId}
        <Button
          type="ghost"
          size="xs"
          class="w-full justify-start px-1.5 whitespace-nowrap"
          onclick={() => {
            isMoreOpen = false;
            handleCopyPageId();
          }}>
          {#snippet leading()}
            {#if copiedId}
              <CopyCheck class="size-3.5 text-copilot" />
            {:else}
              <Hash class="size-3.5" />
            {/if}
          {/snippet}
          <span>{copiedId ? 'Copied ID!' : 'Copy Post ID'}</span>
        </Button>
      {/if}
    </div>

    <div
      class="flex flex-col gap-1 border-t border-border-subtle/60 pt-2 sm:border-t-0 sm:px-3 sm:pt-0">
      <span
        class="px-1.5 text-2xs font-semibold tracking-wider text-text-muted uppercase"
        >View</span>
      <Button
        type="ghost"
        size="xs"
        href={viewMarkdownUrl}
        class="w-full justify-start px-1.5 whitespace-nowrap sm:hidden"
        onclick={() => (isMoreOpen = false)}>
        {#snippet leading()}
          <i
            class="bi bi-markdown inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
            aria-hidden="true"></i>
        {/snippet}
        <span>View as Markdown</span>
      </Button>
      <Button
        type="ghost"
        size="xs"
        href={viewTextUrl}
        class="w-full justify-start px-1.5 whitespace-nowrap"
        onclick={() => (isMoreOpen = false)}>
        {#snippet leading()}
          <TextAlignStart class="size-3.5" />
        {/snippet}
        <span>View as Text</span>
      </Button>
    </div>

    <div
      class="flex flex-col gap-1 border-t border-border-subtle/60 pt-2 sm:border-t-0 sm:pt-0 sm:pl-3">
      <span
        class="px-1.5 text-2xs font-semibold tracking-wider text-text-muted uppercase"
        >Save</span>
      <Button
        type="ghost"
        size="xs"
        class="w-full justify-start px-1.5 whitespace-nowrap"
        onclick={() => {
          isMoreOpen = false;
          handleSaveMarkdown();
        }}>
        {#snippet leading()}
          <i
            class="bi bi-filetype-md inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
            aria-hidden="true"></i>
        {/snippet}
        <span>Save as Markdown</span>
      </Button>
      <Button
        type="ghost"
        size="xs"
        class="w-full justify-start px-1.5 whitespace-nowrap"
        onclick={() => {
          isMoreOpen = false;
          handleSaveText();
        }}>
        {#snippet leading()}
          <FileText class="size-3.5" />
        {/snippet}
        <span>Save as Text</span>
      </Button>
    </div>
  </div>
{/snippet}

{#if variant === 'sidebar'}
  <nav
    aria-label="Content actions"
    class={cn(
      'flex flex-col gap-3 rounded-sm glass-card p-4 select-none',
      className
    )}>
    <h3
      class="shrink-0 text-xs font-bold tracking-wider text-text-secondary uppercase select-none">
      Actions
    </h3>
    <div class="grid grid-cols-2 gap-1.5">
      <Button
        type="secondary"
        size="xs"
        class="w-full justify-start px-2"
        onclick={handleCopyPageUrl}>
        {#snippet leading()}
          {#if copiedUrl}
            <CopyCheck class="size-3.5 text-copilot" />
          {:else}
            <Link class="size-3.5" />
          {/if}
        {/snippet}
        <span>{copiedUrl ? 'Copied!' : 'Copy URL'}</span>
      </Button>

      {#if pageId}
        <Button
          type="secondary"
          size="xs"
          class="w-full justify-start px-2"
          onclick={handleCopyPageId}>
          {#snippet leading()}
            {#if copiedId}
              <CopyCheck class="size-3.5 text-copilot" />
            {:else}
              <Hash class="size-3.5" />
            {/if}
          {/snippet}
          <span>{copiedId ? 'Copied ID!' : 'Copy Post ID'}</span>
        </Button>
      {/if}
    </div>

    <div class="flex flex-col gap-1.5 border-t border-border-subtle/60 pt-2">
      <span
        class="text-2xs font-semibold tracking-wider text-text-muted uppercase"
        >Copy</span>
      <div class="grid grid-cols-2 gap-1.5">
        <Button
          type="secondary"
          size="xs"
          class="w-full justify-start px-2"
          onclick={handleCopyMarkdown}>
          {#snippet leading()}
            {#if copiedMarkdown}
              <CopyCheck class="size-3.5 text-copilot" />
            {:else}
              <Copy class="size-3.5" />
            {/if}
          {/snippet}
          <span>{copiedMarkdown ? 'Copied!' : 'Markdown'}</span>
        </Button>
        <Button
          type="secondary"
          size="xs"
          class="w-full justify-start px-2"
          onclick={handleCopyPlainText}>
          {#snippet leading()}
            <ScanText class="size-3.5" />
          {/snippet}
          <span>{copiedText ? 'Copied!' : 'Text'}</span>
        </Button>
      </div>
    </div>

    <div class="flex flex-col gap-1.5 border-t border-border-subtle/60 pt-2">
      <span
        class="text-2xs font-semibold tracking-wider text-text-muted uppercase"
        >View</span>
      <div class="grid grid-cols-2 gap-1.5">
        <Button
          href={viewMarkdownUrl}
          type="secondary"
          size="xs"
          class="w-full justify-start px-2">
          {#snippet leading()}
            <i
              class="bi bi-markdown inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
              aria-hidden="true"></i>
          {/snippet}
          <span>Markdown</span>
        </Button>
        <Button
          href={viewTextUrl}
          type="secondary"
          size="xs"
          class="w-full justify-start px-2">
          {#snippet leading()}
            <TextAlignStart class="size-3.5" />
          {/snippet}
          <span>Text</span>
        </Button>
      </div>
    </div>

    <div class="flex flex-col gap-1.5 border-t border-border-subtle/60 pt-2">
      <span
        class="text-2xs font-semibold tracking-wider text-text-muted uppercase"
        >Save</span>
      <div class="grid grid-cols-2 gap-1.5">
        <Button
          type="secondary"
          size="xs"
          class="w-full justify-start px-2"
          onclick={handleSaveMarkdown}>
          {#snippet leading()}
            <i
              class="bi bi-filetype-md inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
              aria-hidden="true"></i>
          {/snippet}
          <span>Markdown</span>
        </Button>
        <Button
          type="secondary"
          size="xs"
          class="w-full justify-start px-2"
          onclick={handleSaveText}>
          {#snippet leading()}
            <FileText class="size-3.5" />
          {/snippet}
          <span>Text</span>
        </Button>
      </div>
    </div>
  </nav>
{:else}
  <div
    class={cn(
      'flex flex-nowrap items-center gap-1.5 text-2xs select-none',
      className
    )}>
    <Button
      type="secondary"
      size="xs"
      onclick={handleCopyMarkdown}
      class="shrink-0 text-text-secondary hover:text-copilot">
      {#snippet leading()}
        {#if copiedMarkdown}
          <CopyCheck class="size-3.5 text-copilot" />
        {:else}
          <Copy class="size-3.5" />
        {/if}
      {/snippet}
      <span>{copiedMarkdown ? 'Copied Markdown!' : 'Copy as Markdown'}</span>
    </Button>

    <Button
      type="secondary"
      size="xs"
      href={viewMarkdownUrl}
      class="hidden shrink-0 text-text-secondary hover:text-copilot sm:inline-flex">
      {#snippet leading()}
        <i
          class="bi bi-markdown inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
          aria-hidden="true"></i>
      {/snippet}
      <span>View as Markdown</span>
    </Button>

    <Button
      type="secondary"
      size="xs"
      onclick={handleCopyPageUrl}
      class="hidden text-text-secondary hover:text-copilot sm:inline-flex">
      {#snippet leading()}
        {#if copiedUrl}
          <CopyCheck class="size-3.5 text-copilot" />
        {:else}
          <Link class="size-3.5" />
        {/if}
      {/snippet}
      <span>{copiedUrl ? 'Copied URL!' : 'Copy URL'}</span>
    </Button>

    <div
      bind:this={moreContainerRef}
      class="relative inline-block text-left">
      <Button
        type="ghost"
        size="xs"
        onclick={toggleMore}
        aria-label="More actions"
        aria-expanded={isMoreOpen}
        aria-haspopup="menu"
        class={cn(
          'size-6.5! px-0! text-text-muted hover:text-copilot',
          isMoreOpen && 'border border-copilot text-copilot'
        )}>
        <EllipsisVertical class="size-3.5" />
      </Button>

      {#if isMoreOpen}
        {@render popoverMenu()}
      {/if}
    </div>
  </div>
{/if}
