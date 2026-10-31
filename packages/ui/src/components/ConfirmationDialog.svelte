<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { Trash, Copy, Check } from '@lucide/svelte';
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

    let inputKeyword = $state('');
    let isCopied = $state(false);
    let copyTimeout: ReturnType<typeof setTimeout> | null = null;

    function initializeConfirmation(input: HTMLInputElement) {
        inputKeyword = '';
        isCopied = false;
        input.focus();
        return () => {
            if (copyTimeout) clearTimeout(copyTimeout);
        };
    }

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
        if (isLoading) return;
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
    closeOnBackdrop={!isLoading}
    closeOnEscape={!isLoading}
    showCloseButton={!isLoading}
    compact
    class={className}
    onClose={close}>
    {#if requiredKeyword}
        <div class="mt-4 flex flex-col gap-2 font-sans">
            <p class="text-xs text-fg-secondary">
                Type in
                <span
                    class="inline-flex items-center gap-1 rounded-md border border-line-subtle bg-transparent py-0.5 pr-1 pl-1.5 font-mono text-xs font-bold text-fg select-all">
                    <span>{requiredKeyword}</span>
                    <button
                        type="button"
                        onclick={copyToClipboard}
                        class="touch-target relative inline-flex size-4 cursor-pointer items-center justify-center rounded text-fg-muted transition-colors hover:text-fg-accent"
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
                {@attach initializeConfirmation}
                type="text"
                name="confirmation-keyword"
                bind:value={inputKeyword}
                onkeydown={handleKeydown}
                aria-label="Confirmation keyword"
                autocomplete="off"
                spellcheck={false}
                disabled={isLoading}
                placeholder={requiredKeyword}
                class="w-full rounded-md border border-line-subtle bg-surface px-3 py-2 text-xs text-fg shadow-button-surface transition-colors outline-none placeholder:text-fg-secondary/70 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50" />
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
