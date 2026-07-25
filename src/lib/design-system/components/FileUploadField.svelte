<!-- @format -->
<script lang="ts">
  import {cn} from '../utils/cn'

  interface Props {
    id: string
    label?: string
    accept?: string
    disabled?: boolean
    error?: string
    selectedFileName?: string
    onFileSelect?: (file: File | null) => void
    class?: string
  }

  let {
    id,
    label = 'Upload File',
    accept = '*/*',
    disabled = false,
    error = '',
    selectedFileName = '',
    onFileSelect,
    class: className = ''
  }: Props = $props()

  let fileInputRef = $state<HTMLInputElement | null>(null)
  let isDragging = $state(false)

  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement
    if (input.files && input.files[0]) {
      onFileSelect?.(input.files[0])
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    isDragging = false
    if (disabled) return

    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      onFileSelect?.(e.dataTransfer.files[0])
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    if (!disabled) isDragging = true
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
    {disabled}
    onchange={handleFileChange}
    class="sr-only" />

  <div
    role="button"
    aria-label={label}
    tabindex={disabled ? undefined : 0}
    onclick={() => !disabled && fileInputRef?.click()}
    onkeydown={e =>
      (e.key === 'Enter' || e.key === ' ') && fileInputRef?.click()}
    ondrop={handleDrop}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    class={cn(
      'group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
      isDragging ?
        'border-copilot bg-copilot-subtle/40'
      : 'border-border-default bg-surface/50 hover:border-border-strong hover:bg-surface-hover',
      error ? 'border-danger! bg-danger-subtle/10!' : '',
      disabled ? 'cursor-not-allowed opacity-50' : ''
    )}>
    {#if selectedFileName}
      <div
        class="flex items-center gap-2 text-xs font-semibold text-text-primary">
        <i
          class="bi bi-file-earmark-check-fill text-lg text-copilot"
          aria-hidden="true"></i>
        <span class="max-w-xs truncate">{selectedFileName}</span>
        <button
          type="button"
          aria-label="Remove selected file"
          onclick={e => {
            e.stopPropagation()
            clearFile()
          }}
          class="ml-2 rounded p-1 text-text-muted hover:bg-danger-subtle hover:text-danger">
          <i class="bi bi-x-lg text-xs" aria-hidden="true"></i>
        </button>
      </div>
    {:else}
      <i
        class="bi bi-cloud-arrow-up text-3xl text-text-muted transition-colors group-hover:text-copilot"
        aria-hidden="true"></i>
      <p class="mt-2 text-xs font-semibold text-text-primary">
        Click to upload or drag & drop
      </p>
      <p class="mt-0.5 text-[11px] text-text-muted">{accept} files accepted</p>
    {/if}
  </div>

  {#if error}
    <span
      role="alert"
      class="mt-1 flex items-center gap-1 text-[11px] font-medium text-danger">
      <i class="bi bi-exclamation-circle-fill" aria-hidden="true"></i>
      {error}
    </span>
  {/if}
</div>
