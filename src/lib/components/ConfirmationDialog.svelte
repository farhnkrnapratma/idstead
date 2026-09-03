<script lang="ts">
  import {Trash} from '@lucide/svelte';
  import Dialog from './Dialog.svelte';
  import Button from './Button.svelte';

  interface Props {
    isOpen: boolean;
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    isLoading?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
    children?: import('svelte').Snippet;
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
    onConfirm = () => {},
    onCancel = () => {},
    children,
    class: className = ''
  }: Props = $props();

  function close() {
    isOpen = false;
    onCancel();
  }

  function confirm() {
    onConfirm();
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
        {isLoading}
        onclick={confirm}>
        {#snippet leading()}
          {#if isDestructive}
            <Trash class="size-3.5" />
          {/if}
        {/snippet}
        {confirmLabel || (isDestructive ? 'Delete' : 'Confirm')}
      </Button>
    </div>
  {/snippet}
</Dialog>
