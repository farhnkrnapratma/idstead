<script lang="ts">
  import {FileCheck2, UploadCloud, AlertCircle} from '@lucide/svelte';
  import {cn} from '../utils/cn';
  import Button from './Button.svelte';

  interface Props {
    id: string;
    label?: string;
    hint?: string;
    accept?: string;
    disabled?: boolean;
    isUploading?: boolean;
    uploadingLabel?: string;
    error?: string;
    selectedFileName?: string;
    fileSize?: string;
    onFileSelect?: (file: File | null) => void;
    class?: string;
  }

  let {
    id,
    label = 'Click to upload or drag & drop',
    hint = '',
    accept = '*/*',
    disabled = false,
    isUploading = false,
    uploadingLabel = 'Uploading…',
    error = '',
    selectedFileName = '',
    fileSize = '',
    onFileSelect,
    class: className = ''
  }: Props = $props();

  let fileInputRef = $state<HTMLInputElement | null>(null);
  let isDragging = $state(false);

  let isDisabled = $derived(disabled || isUploading);

  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      onFileSelect?.(input.files[0]);
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
    bind:this={fileInputRef}
    type="file"
    {id}
    {accept}
    disabled={isDisabled}
    onchange={handleFileChange}
    class="sr-only" />

  <div
    role="button"
    aria-label={label}
    tabindex={isDisabled ? undefined : 0}
    onclick={() => !isDisabled && fileInputRef?.click()}
    onkeydown={e =>
      !isDisabled
      && (e.key === 'Enter' || e.key === ' ')
      && fileInputRef?.click()}
    ondrop={handleDrop}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    class={cn(
      'group relative flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed p-6 text-center transition-all select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
      isDragging ?
        'border-copilot bg-copilot-subtle/40'
      : cn(
          'border-border-default bg-surface/50',
          !isDisabled && 'hover:border-border-strong hover:bg-surface-hover'
        ),
      error ? 'border-danger! bg-danger-subtle/10!' : '',
      isDisabled ? 'cursor-not-allowed opacity-50' : ''
    )}>
    {#if isUploading}
      <svg
        class="h-7 w-7 animate-spin text-copilot"
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
      <p class="animate-pulse text-xs font-semibold text-copilot">
        {uploadingLabel}
      </p>
    {:else if selectedFileName}
      <FileCheck2 class="size-8 text-copilot" />
      <p
        class="max-w-full truncate font-mono text-sm font-semibold text-text-primary">
        {selectedFileName}
      </p>
      {#if fileSize}
        <p class="font-mono text-xs text-text-muted">{fileSize}</p>
      {/if}
      <Button
        type="ghost"
        tone="critical"
        size="xs"
        onclick={e => {
          e.stopPropagation();
          clearFile();
        }}>
        Remove
      </Button>
    {:else}
      <UploadCloud
        class="size-8 text-text-secondary transition-colors group-hover:text-copilot" />
      <span class="font-sans-title text-sm font-medium text-text-primary"
        >{label}</span>
      {#if hint}
        <span class="text-xs text-text-muted">{hint}</span>
      {/if}
    {/if}
  </div>

  {#if error}
    <span
      role="alert"
      class="mt-1 flex items-center gap-1 text-xxs font-medium text-danger">
      <AlertCircle class="size-3 shrink-0" />
      {error}
    </span>
  {/if}
</div>
