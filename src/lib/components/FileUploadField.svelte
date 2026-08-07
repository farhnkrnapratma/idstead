<!-- @format -->
<script lang="ts">
  import {cn} from '../utils/cn'

  interface Props {
    id: string
    label?: string
    hint?: string
    accept?: string
    disabled?: boolean
    isUploading?: boolean
    uploadingLabel?: string
    error?: string
    selectedFileName?: string
    fileSize?: string
    onFileSelect?: (file: File | null) => void
    class?: string
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
  }: Props = $props()

  let fileInputRef = $state<HTMLInputElement | null>(null)
  let isDragging = $state(false)

  let isDisabled = $derived(disabled || isUploading)

  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement
    if (input.files && input.files[0]) {
      onFileSelect?.(input.files[0])
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    isDragging = false
    if (isDisabled) return

    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      onFileSelect?.(e.dataTransfer.files[0])
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    if (!isDisabled) isDragging = true
  }

  function handleDragLeave() {
    isDragging = false
  }

  function clearFile() {
    if (fileInputRef) fileInputRef.value = ''
    onFileSelect?.(null)
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
      <i
        class="bi bi-arrow-repeat animate-spin text-2xl text-copilot"
        aria-hidden="true"></i>
      <p class="text-xs font-semibold text-copilot">{uploadingLabel}</p>
    {:else if selectedFileName}
      <i
        class="bi bi-file-earmark-check-fill text-2xl text-copilot"
        aria-hidden="true"></i>
      <p
        class="max-w-full truncate font-mono text-sm font-semibold text-text-primary">
        {selectedFileName}
      </p>
      {#if fileSize}
        <p class="font-mono text-xs text-text-muted">{fileSize}</p>
      {/if}
      <button
        type="button"
        onclick={e => {
          e.stopPropagation()
          clearFile()
        }}
        class="text-xs font-semibold text-text-muted transition-colors hover:text-danger">
        Remove
      </button>
    {:else}
      <i
        class="bi bi-cloud-arrow-up text-2xl text-text-secondary transition-colors group-hover:text-copilot"
        aria-hidden="true"></i>
      <span class="text-sm font-medium text-text-primary">{label}</span>
      {#if hint}
        <span class="text-xs text-text-muted">{hint}</span>
      {/if}
    {/if}
  </div>

  {#if error}
    <span
      role="alert"
      class="mt-1 flex items-center gap-1 text-xxs font-medium text-danger">
      <i
        class="bi bi-exclamation-circle-fill"
        aria-hidden="true"></i>
      {error}
    </span>
  {/if}
</div>
