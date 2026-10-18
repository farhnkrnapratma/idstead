<script lang="ts">
    import type { Snippet } from 'svelte';
    import { FileCheck2, UploadCloud } from '@lucide/svelte';
    import { cn } from '../utils/cn';
    import Button from './Button.svelte';
    import FieldMessage from './FieldMessage.svelte';

    interface Props {
        id: string;
        label?: string;
        hint?: string;
        accept?: string;
        disabled?: boolean;
        required?: boolean;
        isUploading?: boolean;
        allowReselectWhileUploading?: boolean;
        uploadingLabel?: string;
        error?: string;
        selectedFileName?: string;
        fileSize?: string;
        onFileSelect?: (file: File | null) => void;
        compact?: boolean;
        actions?: Snippet<[{ trigger: () => void }]>;
        class?: string;
    }

    let {
        id,
        label = 'Click to upload or drag & drop',
        hint = '',
        accept = '*/*',
        disabled = false,
        required = false,
        isUploading = false,
        allowReselectWhileUploading = false,
        uploadingLabel = 'Uploading…',
        error = '',
        selectedFileName = '',
        fileSize = '',
        onFileSelect,
        actions,
        compact = false,
        class: className = ''
    }: Props = $props();

    let fileInputRef: HTMLInputElement | null = null;
    let isDragging = $state(false);

    let isDisabled = $derived(disabled || (isUploading && !allowReselectWhileUploading));

    function handleFileChange(e: Event) {
        const input = e.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            onFileSelect?.(input.files[0]);
            input.value = '';
        }
    }

    function handleDrop(e: DragEvent) {
        e.preventDefault();
        isDragging = false;
        if (isDisabled) return;

        if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
            onFileSelect?.(e.dataTransfer.files[0]);
        }
    }

    function handleDragOver(e: DragEvent) {
        e.preventDefault();
        if (!isDisabled) isDragging = true;
    }

    function handleDragLeave() {
        isDragging = false;
    }

    function clearFile() {
        if (fileInputRef) fileInputRef.value = '';
        onFileSelect?.(null);
    }
</script>

<div class={cn('flex w-full flex-col gap-1.5', className)}>
    <input
        {@attach element => {
            fileInputRef = element;
            return () => {
                fileInputRef = null;
            };
        }}
        type="file"
        {id}
        {accept}
        aria-required={required}
        aria-invalid={!!error}
        disabled={isDisabled}
        onchange={handleFileChange}
        tabindex="-1"
        aria-hidden="true"
        class="sr-only" />

    <div
        role="button"
        aria-label={label}
        tabindex={isDisabled ? undefined : 0}
        onclick={() => !isDisabled && fileInputRef?.click()}
        onkeydown={e => {
            if (e.target !== e.currentTarget || isDisabled) return;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef?.click();
            }
        }}
        ondrop={handleDrop}
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        class={cn(
            'group relative flex min-w-0 flex-1 cursor-pointer dashed-surface transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
            compact ?
                'flex-row items-center gap-3 px-4 py-3 text-left'
            :   'min-h-40 flex-col items-center justify-center gap-2 p-6 text-center',
            isDragging ? 'border-accent! bg-accent-subtle/40!'
            : !isDisabled ? 'hover:border-border-default hover:bg-surface-hover/60'
            : '',
            error ? 'border-danger! bg-danger-subtle/10!' : '',
            isDisabled ? 'cursor-not-allowed opacity-50' : ''
        )}>
        {#if isUploading}
            <svg
                class={cn('animate-spin text-accent-text', compact ? 'size-5 shrink-0' : 'size-7')}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true">
                <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"></circle>
                <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
            </svg>
            <p class="animate-pulse text-xs font-semibold text-accent-text">
                {uploadingLabel}
            </p>
        {:else if selectedFileName}
            <FileCheck2 class={cn('text-accent-text', compact ? 'size-5 shrink-0' : 'size-8')} />
            <span class={cn('flex min-w-0 flex-col', compact ? 'gap-0.5' : 'items-center gap-2')}>
                <span class="max-w-full truncate font-mono text-sm font-semibold text-text-primary">
                    {selectedFileName}
                </span>
                {#if fileSize}
                    <span class="font-mono text-xs text-text-muted">{fileSize}</span>
                {/if}
            </span>
        {:else if compact}
            <UploadCloud
                class="size-5 shrink-0 text-text-secondary transition-colors group-hover:text-accent-text" />
            <span class="flex min-w-0 flex-col gap-0.5">
                {#if actions}
                    {@render actions({ trigger: () => fileInputRef?.click() })}
                {:else}
                    <span class="text-sm font-medium text-text-primary">{label}</span>
                {/if}
                {#if hint}
                    <span class="text-xs text-text-muted">{hint}</span>
                {/if}
            </span>
        {:else}
            <UploadCloud
                class="size-8 text-text-secondary transition-colors group-hover:text-accent-text" />
            {#if actions}
                {@render actions({ trigger: () => fileInputRef?.click() })}
            {:else}
                <span class="text-sm font-medium text-text-primary">{label}</span>
            {/if}
            {#if hint}
                <span class="text-xs text-text-muted">{hint}</span>
            {/if}
        {/if}
    </div>

    {#if selectedFileName && !isUploading}
        <Button
            type="ghost"
            tone="critical"
            size="xs"
            class="self-start"
            disabled={isDisabled}
            onclick={clearFile}>
            Remove file
        </Button>
    {/if}

    {#if error}
        <FieldMessage
            variant="error"
            message={error} />
    {/if}
</div>
