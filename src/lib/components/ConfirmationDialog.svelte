<script lang="ts">
  import {Trash, Copy, Check} from '@lucide/svelte';
  import Dialog from './Dialog.svelte';
  import Button from './Button.svelte';

  import {tick} from 'svelte';

  interface Props {
    isOpen: boolean;
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    isLoading?: boolean;
    requiredKeyword?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    children?: import('svelte').Snippet;
    confirmIcon?: import('svelte').Snippet;
    class?: string;
  }

  let {
    isOpen = $bindable(false),
    title,
    message = '',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    isDestructive = false,
    isLoading = false,
    requiredKeyword = '',
    onConfirm = () => {},
    onCancel = () => {},
    children,
    confirmIcon,
    class: className = ''
  }: Props = $props();

  let inputEl = $state<HTMLInputElement | null>(null);
  let inputKeyword = $state('');
  let isCopied = $state(false);
  let copyTimeout: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if (!isOpen) {
      inputKeyword = '';
      isCopied = false;
      if (copyTimeout) clearTimeout(copyTimeout);
    } else if (requiredKeyword) {
      void tick().then(() => inputEl?.focus());
    }
  });

  const isConfirmDisabled = $derived(
    isLoading || (Boolean(requiredKeyword) && inputKeyword !== requiredKeyword)
  );

  async function copyToClipboard() {
    if (!requiredKeyword || typeof navigator === 'undefined') return;
    try {
      await navigator.clipboard.writeText(requiredKeyword);
      isCopied = true;
      if (copyTimeout) clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => {
        isCopied = false;
      }, 1500);
    } catch {}
  }

  function close() {
    isOpen = false;
    onCancel();
  }

  function confirm() {
    if (isConfirmDisabled) return;
    onConfirm();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !isConfirmDisabled) {
      e.preventDefault();
      confirm();
    }
  }
</script>

<Dialog
  bind:isOpen
  {title}
  description={message}
  size="sm"
  compact
  class={className}
  onClose={close}>
  {#if requiredKeyword}
    <div class="mt-4 flex flex-col gap-2 font-sans">
      <p class="text-xs text-text-secondary">
        Type in
        <span
          class="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface-subtle px-1.5 py-0.5 font-mono text-xs font-bold text-text-primary select-all">
          <span>{requiredKeyword}</span>
          <button
            type="button"
            onclick={copyToClipboard}
            class="inline-flex size-4 cursor-pointer items-center justify-center rounded text-text-muted transition-colors hover:text-accent"
            aria-label="Copy keyword"
            title="Copy keyword">
            {#if isCopied}
              <Check class="size-3 text-success" />
            {:else}
              <Copy class="size-3" />
            {/if}
          </button>
        </span>
        to confirm.
      </p>
      <input
        bind:this={inputEl}
        type="text"
        bind:value={inputKeyword}
        onkeydown={handleKeydown}
        placeholder={requiredKeyword}
        class="w-full rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-xs text-text-primary transition-colors outline-none placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent" />
    </div>
  {/if}

  {#if children}
    {@render children()}
  {/if}
  {#snippet footer()}
    <div class="grid w-full grid-cols-2 gap-2.5">
      <Button
        type="secondary"
        size="sm"
        fullWidth
        disabled={isLoading}
        onclick={close}>
        {cancelLabel}
      </Button>
      <Button
        type={isDestructive ? 'danger' : 'primary'}
        size="sm"
        fullWidth
        disabled={isConfirmDisabled}
        {isLoading}
        onclick={confirm}>
        {#snippet leading()}
          {#if isDestructive}
            {#if confirmIcon}
              {@render confirmIcon()}
            {:else}
              <Trash class="size-3.5" />
            {/if}
          {/if}
        {/snippet}
        {confirmLabel || (isDestructive ? 'Delete' : 'Confirm')}
      </Button>
    </div>
  {/snippet}
</Dialog>
