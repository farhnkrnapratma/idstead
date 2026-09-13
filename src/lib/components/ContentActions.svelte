<script lang="ts">
  import {
    Copy,
    CopyCheck,
    Link,
    EllipsisVertical,
    Hash,
    ScanText,
    TextAlignStart,
    FileText,
    ChevronDown
  } from '@lucide/svelte';
  import {toastStore} from '../stores/toastStore.svelte';
  import {markdownToPlainText} from '../utils/markdownToText';
  import {cn} from '../utils/cn';
  import Button from './Button.svelte';
  import {shortcut} from '../utils/shortcut.svelte';
  import {buttonKey, argKey, VIEW_FORMAT_KEYS} from '$lib/shortcuts';

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
    showCopyUrl?: boolean;
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
    showCopyUrl = true,
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
    class="absolute top-full right-0 left-auto z-50 mt-1.5 flex max-h-[85vh] max-w-[calc(100vw-2rem)] flex-row divide-x divide-border-subtle/60 overflow-y-auto rounded-md border border-border-subtle bg-surface-elevated/95 p-2.5 shadow-xl backdrop-blur-md">
    {#if showCopyUrl || pageId}
      <div class="flex flex-col gap-1 pr-3">
        <span
          class="px-1.5 text-2xs font-semibold tracking-wider text-text-muted uppercase"
          >Copy</span>
        {#if showCopyUrl}
          <Button
            shortcutGroup="copy"
            shortcutChordKey={argKey('/copy', 'url')}
            shortcutLabel="Post URL"
            type="ghost"
            size="xs"
            label={copiedUrl ? 'Copied!' : 'Post URL'}
            truncateMiddle
            class="w-full justify-start px-1.5 text-xs font-normal! whitespace-nowrap text-text-secondary!"
            onclick={() => {
              isMoreOpen = false;
              handleCopyPageUrl();
            }}>
            {#snippet leading()}
              {#if copiedUrl}
                <CopyCheck class="size-3.5 text-accent" />
              {:else}
                <Link class="size-3.5" />
              {/if}
            {/snippet}
          </Button>
        {/if}
        {#if pageId}
          <Button
            shortcutGroup="copy"
            shortcutChordKey={argKey('/copy', 'pid')}
            shortcutLabel="Post ID"
            type="ghost"
            size="xs"
            label={copiedId ? 'Copied!' : 'Post ID'}
            truncateMiddle
            class="w-full justify-start px-1.5 text-xs font-normal! whitespace-nowrap text-text-secondary!"
            onclick={() => {
              isMoreOpen = false;
              handleCopyPageId();
            }}>
            {#snippet leading()}
              {#if copiedId}
                <CopyCheck class="size-3.5 text-accent" />
              {:else}
                <Hash class="size-3.5" />
              {/if}
            {/snippet}
          </Button>
        {/if}
      </div>
    {/if}

    <div class="flex flex-col gap-2 pl-3 sm:contents">
      <div
        class="flex flex-col gap-1 sm:px-3 {showCopyUrl || pageId ? '' : (
          'sm:pr-3'
        )}">
        <span
          class="px-1.5 text-2xs font-semibold tracking-wider text-text-muted uppercase"
          >Text</span>
        <Button
          shortcutGroup="copy"
          shortcutChordKey={argKey('/copy', 'txt')}
          shortcutLabel="Copy as TXT"
          type="ghost"
          size="xs"
          label={copiedText ? 'Copied!' : 'Copy as TXT'}
          truncateMiddle
          class="w-full justify-start px-1.5 text-xs font-normal! whitespace-nowrap text-text-secondary!"
          onclick={() => {
            isMoreOpen = false;
            handleCopyPlainText();
          }}>
          {#snippet leading()}
            {#if copiedText}
              <CopyCheck class="size-3.5 text-accent" />
            {:else}
              <ScanText class="size-3.5" />
            {/if}
          {/snippet}
        </Button>
        <Button
          shortcutGroup="view"
          shortcutChordKey={VIEW_FORMAT_KEYS.txt}
          shortcutLabel="View as TXT"
          type="ghost"
          size="xs"
          href={viewTextUrl}
          label="View as TXT"
          truncateMiddle
          class="w-full justify-start px-1.5 text-xs font-normal! whitespace-nowrap text-text-secondary!"
          onclick={() => (isMoreOpen = false)}>
          {#snippet leading()}
            <TextAlignStart class="size-3.5" />
          {/snippet}
        </Button>
      </div>

      <div
        class="flex flex-col gap-1 border-t border-border-subtle/60 pt-2 sm:border-t-0 sm:pt-0 sm:pl-3">
        <span
          class="px-1.5 text-2xs font-semibold tracking-wider text-text-muted uppercase"
          >Save</span>
        <Button
          shortcutGroup="save"
          shortcutChordKey={argKey('/save', 'md')}
          shortcutLabel="Save as MD"
          type="ghost"
          size="xs"
          label="Save as MD"
          truncateMiddle
          class="w-full justify-start px-1.5 text-xs font-normal! whitespace-nowrap text-text-secondary!"
          onclick={() => {
            isMoreOpen = false;
            handleSaveMarkdown();
          }}>
          {#snippet leading()}
            <i
              class="bi bi-filetype-md inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
              aria-hidden="true"></i>
          {/snippet}
        </Button>
        <Button
          shortcutGroup="save"
          shortcutChordKey={argKey('/save', 'txt')}
          shortcutLabel="Save as TXT"
          type="ghost"
          size="xs"
          label="Save as TXT"
          truncateMiddle
          class="w-full justify-start px-1.5 text-xs font-normal! whitespace-nowrap text-text-secondary!"
          onclick={() => {
            isMoreOpen = false;
            handleSaveText();
          }}>
          {#snippet leading()}
            <FileText class="size-3.5" />
          {/snippet}
        </Button>
      </div>
    </div>
  </div>
{/snippet}

{#if variant === 'sidebar'}
  <nav
    aria-label="Content actions"
    class={cn(
      'flex shrink-0 flex-col gap-2.5 rounded-md glass-card p-3.5 text-left select-none sm:p-4',
      className
    )}>
    <h3
      class="text-xs font-bold tracking-wider text-text-secondary uppercase select-none">
      Actions
    </h3>

    <div class="grid grid-cols-2 gap-1.5">
      <Button
        shortcutGroup="copy"
        shortcutChordKey={argKey('/copy', 'md')}
        shortcutLabel="Copy as MD"
        type="secondary"
        size="xs"
        class="w-full justify-start gap-1.5 px-2 py-1.5 text-xs font-normal! text-text-secondary!"
        onclick={handleCopyMarkdown}
        label={copiedMarkdown ? 'Copied!' : 'Copy as MD'}
        truncateMiddle>
        {#snippet leading()}
          {#if copiedMarkdown}
            <CopyCheck class="size-3.5 text-accent" />
          {:else}
            <Copy class="size-3.5 text-text-secondary" />
          {/if}
        {/snippet}
      </Button>

      <Button
        shortcutGroup="view"
        shortcutChordKey={VIEW_FORMAT_KEYS.md}
        shortcutLabel="View as MD"
        href={viewMarkdownUrl}
        type="secondary"
        size="xs"
        class="w-full justify-start gap-1.5 px-2 py-1.5 text-xs font-normal! text-text-secondary!"
        label="View as MD"
        truncateMiddle>
        {#snippet leading()}
          <i
            class="bi bi-markdown inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none text-text-secondary [&::before]:align-[0] [&::before]:leading-none"
            aria-hidden="true"></i>
        {/snippet}
      </Button>
    </div>

    <details class="group my-0 overflow-hidden pt-0.5">
      <summary
        use:shortcut={{
          combo: buttonKey('moreActions'),
          label: 'More options',
          placement: 'trailing'
        }}
        class="group/summary relative flex min-h-0 cursor-pointer list-none items-center justify-between gap-1 border-0! bg-transparent! px-0 py-0.5 text-xs font-bold tracking-wider text-text-secondary uppercase no-underline! transition-colors select-none group-open:border-b-0! group-open:bg-transparent! hover:bg-transparent! hover:text-security [&::-webkit-details-marker]:hidden">
        <span>More options</span>
        <ChevronDown
          class="size-3.5 text-text-secondary transition-transform duration-200 group-open:rotate-180 group-hover/summary:text-security" />
      </summary>

      <div class="flex flex-col gap-2.5 pt-1.5">
        {#if showCopyUrl || pageId}
          <div class="flex flex-col gap-1.5">
            <span
              class="text-2xs font-semibold tracking-wider text-text-muted uppercase select-none"
              >Copy</span>
            <div
              class="grid {showCopyUrl && pageId ? 'grid-cols-2' : (
                'grid-cols-1'
              )} gap-1.5">
              {#if showCopyUrl}
                <Button
                  shortcutGroup="copy"
                  shortcutChordKey={argKey('/copy', 'url')}
                  shortcutLabel="Post URL"
                  type="secondary"
                  size="xs"
                  class="w-full justify-start gap-1.5 px-2 py-1 text-xs font-normal! text-text-secondary!"
                  onclick={handleCopyPageUrl}
                  label={copiedUrl ? 'Copied!' : 'Post URL'}
                  truncateMiddle>
                  {#snippet leading()}
                    {#if copiedUrl}
                      <CopyCheck class="size-3.5 text-accent" />
                    {:else}
                      <Link class="size-3.5 text-text-secondary" />
                    {/if}
                  {/snippet}
                </Button>
              {/if}

              {#if pageId}
                <Button
                  shortcutGroup="copy"
                  shortcutChordKey={argKey('/copy', 'pid')}
                  shortcutLabel="Post ID"
                  type="secondary"
                  size="xs"
                  class="w-full justify-start gap-1.5 px-2 py-1 text-xs font-normal! text-text-secondary!"
                  onclick={handleCopyPageId}
                  label={copiedId ? 'Copied!' : 'Post ID'}
                  truncateMiddle>
                  {#snippet leading()}
                    {#if copiedId}
                      <CopyCheck class="size-3.5 text-accent" />
                    {:else}
                      <Hash class="size-3.5 text-text-secondary" />
                    {/if}
                  {/snippet}
                </Button>
              {/if}
            </div>
          </div>
        {/if}

        <div class="flex flex-col gap-1.5">
          <span
            class="text-2xs font-semibold tracking-wider text-text-muted uppercase select-none"
            >Text</span>
          <div class="grid grid-cols-2 gap-1.5">
            <Button
              shortcutGroup="copy"
              shortcutChordKey={argKey('/copy', 'txt')}
              shortcutLabel="Copy as TXT"
              type="secondary"
              size="xs"
              class="w-full justify-start gap-1.5 px-2 py-1 text-xs font-normal! text-text-secondary!"
              onclick={handleCopyPlainText}
              label={copiedText ? 'Copied!' : 'Copy as TXT'}
              truncateMiddle>
              {#snippet leading()}
                {#if copiedText}
                  <CopyCheck class="size-3.5 text-accent" />
                {:else}
                  <ScanText class="size-3.5 text-text-secondary" />
                {/if}
              {/snippet}
            </Button>

            <Button
              shortcutGroup="view"
              shortcutChordKey={VIEW_FORMAT_KEYS.txt}
              shortcutLabel="View as TXT"
              href={viewTextUrl}
              type="secondary"
              size="xs"
              class="w-full justify-start gap-1.5 px-2 py-1 text-xs font-normal! text-text-secondary!"
              label="View as TXT"
              truncateMiddle>
              {#snippet leading()}
                <TextAlignStart class="size-3.5 text-text-secondary" />
              {/snippet}
            </Button>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <span
            class="text-2xs font-semibold tracking-wider text-text-muted uppercase select-none"
            >Save</span>
          <div class="grid grid-cols-2 gap-1.5">
            <Button
              shortcutGroup="save"
              shortcutChordKey={argKey('/save', 'md')}
              shortcutLabel="Save as MD"
              type="secondary"
              size="xs"
              class="w-full justify-start gap-1.5 px-2 py-1 text-xs font-normal! text-text-secondary!"
              onclick={handleSaveMarkdown}
              label="Save as MD"
              truncateMiddle>
              {#snippet leading()}
                <i
                  class="bi bi-filetype-md inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none text-text-secondary [&::before]:align-[0] [&::before]:leading-none"
                  aria-hidden="true"></i>
              {/snippet}
            </Button>
            <Button
              shortcutGroup="save"
              shortcutChordKey={argKey('/save', 'txt')}
              shortcutLabel="Save as TXT"
              type="secondary"
              size="xs"
              class="w-full justify-start gap-1.5 px-2 py-1 text-xs font-normal! text-text-secondary!"
              onclick={handleSaveText}
              label="Save as TXT"
              truncateMiddle>
              {#snippet leading()}
                <FileText class="size-3.5 text-text-secondary" />
              {/snippet}
            </Button>
          </div>
        </div>
      </div>
    </details>
  </nav>
{:else}
  <div
    class={cn(
      'flex flex-nowrap items-center gap-1.5 text-2xs select-none',
      className
    )}>
    <Button
      shortcutGroup="copy"
      shortcutChordKey={argKey('/copy', 'md')}
      shortcutLabel="Copy as MD"
      type="secondary"
      size="xs"
      onclick={handleCopyMarkdown}
      label={copiedMarkdown ? 'Copied!' : 'Copy as MD'}
      truncateMiddle
      class="h-7 min-w-0 flex-1 justify-center gap-1.5 px-2 py-0.5 text-2xs font-normal! text-text-secondary! hover:text-accent">
      {#snippet leading()}
        {#if copiedMarkdown}
          <CopyCheck class="size-3.5 shrink-0 text-accent" />
        {:else}
          <Copy class="size-3.5 shrink-0" />
        {/if}
      {/snippet}
    </Button>

    <Button
      shortcutGroup="view"
      shortcutChordKey={VIEW_FORMAT_KEYS.md}
      shortcutLabel="View as MD"
      type="secondary"
      size="xs"
      href={viewMarkdownUrl}
      label="View as MD"
      truncateMiddle
      class="h-7 min-w-0 flex-1 justify-center gap-1.5 px-2 py-0.5 text-2xs font-normal! text-text-secondary! hover:text-accent">
      {#snippet leading()}
        <i
          class="bi bi-markdown inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
          aria-hidden="true"></i>
      {/snippet}
    </Button>

    <div
      bind:this={moreContainerRef}
      class="relative inline-block shrink-0 text-left">
      <Button
        keyboardShortcut={buttonKey('moreActions')}
        shortcutLabel="More actions"
        type="ghost"
        size="xs"
        onclick={toggleMore}
        aria-label="More actions"
        aria-expanded={isMoreOpen}
        aria-haspopup="menu"
        class={cn(
          'size-7 px-0 text-text-muted hover:text-accent',
          isMoreOpen && 'border border-accent text-accent'
        )}>
        <EllipsisVertical class="size-3.5" />
      </Button>

      {#if isMoreOpen}
        {@render popoverMenu()}
      {/if}
    </div>
  </div>
{/if}
