<script lang="ts">
  import {
    Copy,
    CopyCheck,
    Link,
    Hash,
    ScanText,
    TextAlignStart,
    FileText
  } from '@lucide/svelte';
  import Dialog from './Dialog.svelte';
  import Button from './Button.svelte';
  import type {BlogPost} from '../types';

  interface Props {
    isOpen: boolean;
    post: BlogPost | null;
    onClose: () => void;
    onCopyMarkdown?: () => void;
    onCopyText?: () => void;
    onSaveMarkdown?: () => void;
    onSaveText?: () => void;
    class?: string;
  }

  let {
    isOpen = $bindable(false),
    post,
    onClose,
    onCopyMarkdown,
    onCopyText,
    onSaveMarkdown,
    onSaveText,
    class: className = ''
  }: Props = $props();

  let copiedUrl = $state(false);
  let copiedId = $state(false);

  function copyPostUrl() {
    if (typeof window === 'undefined' || !post) return;
    const url = `${window.location.origin}/blog/${post.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      copiedUrl = true;
      setTimeout(() => {
        copiedUrl = false;
      }, 2000);
    });
  }

  function copyPostId() {
    if (!post) return;
    navigator.clipboard.writeText(post.id).then(() => {
      copiedId = true;
      setTimeout(() => {
        copiedId = false;
      }, 2000);
    });
  }
</script>

<Dialog
  bind:isOpen
  title={post?.title ?? 'Article Actions'}
  description="Quick actions for copying, viewing, saving, or sharing this article."
  size="md"
  class={className}
  {onClose}>
  {#if post}
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <span
          class="text-2xs font-semibold tracking-wider text-text-muted uppercase"
          >Copy</span>
        <div class="grid grid-cols-2 gap-2">
          <Button
            type={copiedUrl ? 'tertiary' : 'secondary'}
            size="xs"
            class="w-full justify-start px-2.5"
            onclick={copyPostUrl}>
            {#snippet leading()}
              {#if copiedUrl}
                <CopyCheck class="size-3.5 text-accent" />
              {:else}
                <Link class="size-3.5" />
              {/if}
            {/snippet}
            <span>{copiedUrl ? 'Copied URL!' : 'Copy URL'}</span>
          </Button>

          <Button
            type="secondary"
            size="xs"
            class="w-full justify-start px-2.5"
            onclick={() => {
              onClose();
              onCopyMarkdown?.();
            }}>
            {#snippet leading()}
              <Copy class="size-3.5" />
            {/snippet}
            <span>Copy as Markdown</span>
          </Button>

          <Button
            type="secondary"
            size="xs"
            class="w-full justify-start px-2.5"
            onclick={() => {
              onClose();
              onCopyText?.();
            }}>
            {#snippet leading()}
              <ScanText class="size-3.5" />
            {/snippet}
            <span>Copy as Text</span>
          </Button>

          <Button
            type={copiedId ? 'tertiary' : 'secondary'}
            size="xs"
            class="w-full justify-start px-2.5"
            onclick={copyPostId}>
            {#snippet leading()}
              {#if copiedId}
                <CopyCheck class="size-3.5 text-accent" />
              {:else}
                <Hash class="size-3.5" />
              {/if}
            {/snippet}
            <span>{copiedId ? 'Copied ID!' : 'Copy Post ID'}</span>
          </Button>
        </div>
      </div>

      <div class="flex flex-col gap-2 border-t border-border-subtle/60 pt-3">
        <span
          class="text-2xs font-semibold tracking-wider text-text-muted uppercase"
          >View</span>
        <div class="grid grid-cols-2 gap-2">
          <Button
            href="/api/v1/blog/{post.slug}?format=md"
            type="secondary"
            size="xs"
            class="w-full justify-start px-2.5"
            onclick={() => onClose()}>
            {#snippet leading()}
              <i
                class="bi bi-markdown inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
                aria-hidden="true"></i>
            {/snippet}
            <span>View as Markdown</span>
          </Button>

          <Button
            href="/api/v1/blog/{post.slug}?format=text"
            type="secondary"
            size="xs"
            class="w-full justify-start px-2.5"
            onclick={() => onClose()}>
            {#snippet leading()}
              <TextAlignStart class="size-3.5" />
            {/snippet}
            <span>View as Text</span>
          </Button>
        </div>
      </div>

      {#if onSaveMarkdown || onSaveText}
        <div class="flex flex-col gap-2 border-t border-border-subtle/60 pt-3">
          <span
            class="text-2xs font-semibold tracking-wider text-text-muted uppercase"
            >Save</span>
          <div class="grid grid-cols-2 gap-2">
            {#if onSaveMarkdown}
              <Button
                type="secondary"
                size="xs"
                class="w-full justify-start px-2.5"
                onclick={() => {
                  onClose();
                  onSaveMarkdown();
                }}>
                {#snippet leading()}
                  <i
                    class="bi bi-filetype-md inline-flex size-3.5 shrink-0 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
                    aria-hidden="true"></i>
                {/snippet}
                <span>Save as Markdown</span>
              </Button>
            {/if}

            {#if onSaveText}
              <Button
                type="secondary"
                size="xs"
                class="w-full justify-start px-2.5"
                onclick={() => {
                  onClose();
                  onSaveText();
                }}>
                {#snippet leading()}
                  <FileText class="size-3.5" />
                {/snippet}
                <span>Save as Text</span>
              </Button>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</Dialog>
