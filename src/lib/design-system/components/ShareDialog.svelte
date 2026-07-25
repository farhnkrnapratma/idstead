<!-- @format -->
<script lang="ts">
  import Dialog from './Dialog.svelte'
  import Button from './Button.svelte'
  import Input from './Input.svelte'
  import IconButton from './IconButton.svelte'

  interface Props {
    isOpen: boolean
    title?: string
    url?: string
    articleTitle?: string
    onClose: () => void
  }

  let {
    isOpen = $bindable(false),
    title = 'Share this Article',
    url = typeof window !== 'undefined' ? window.location.href : '',
    articleTitle = '',
    onClose
  }: Props = $props()

  let copied = $state(false)

  function copyUrl() {
    if (typeof window === 'undefined') return
    const targetUrl = url || window.location.href
    navigator.clipboard.writeText(targetUrl).then(() => {
      copied = true
      setTimeout(() => {
        copied = false
      }, 2500)
    })
  }

  const encodedUrl = $derived(
    encodeURIComponent(
      url || (typeof window !== 'undefined' ? window.location.href : '')
    )
  )
  const encodedTitle = $derived(encodeURIComponent(articleTitle))
</script>

<Dialog
  bind:isOpen
  {title}
  description="Copy the article link or share it directly to social platforms."
  size="md"
  {onClose}
>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-2">
      <Input
        type="text"
        readonly
        value={url
          || (typeof window !== 'undefined' ? window.location.href : '')}
        class="font-mono text-xs select-all"
      />
      <Button
        variant={copied ? 'subtle' : 'secondary'}
        size="md"
        onclick={copyUrl}
      >
        {#if copied}
          <i class="bi bi-check2 text-copilot" aria-hidden="true"></i> Copied!
        {:else}
          <i class="bi bi-clipboard" aria-hidden="true"></i> Copy
        {/if}
      </Button>
    </div>

    <div class="flex items-center justify-center gap-3 pt-2">
      <a
        href="https://x.com/intent/post?url={encodedUrl}&text={encodedTitle}"
        target="_blank"
        rel="noopener noreferrer"
      >
        <IconButton ariaLabel="Share on X" variant="default" size="lg">
          <i class="bi bi-twitter-x text-lg" aria-hidden="true"></i>
        </IconButton>
      </a>

      <a
        href="https://linkedin.com/sharing/share-offsite/?url={encodedUrl}"
        target="_blank"
        rel="noopener noreferrer"
      >
        <IconButton ariaLabel="Share on LinkedIn" variant="default" size="lg">
          <i class="bi bi-linkedin text-lg text-[#0a66c2]" aria-hidden="true"
          ></i>
        </IconButton>
      </a>

      <a
        href="https://www.facebook.com/sharer/sharer.php?u={encodedUrl}"
        target="_blank"
        rel="noopener noreferrer"
      >
        <IconButton ariaLabel="Share on Facebook" variant="default" size="lg">
          <i class="bi bi-facebook text-lg text-[#1877f2]" aria-hidden="true"
          ></i>
        </IconButton>
      </a>

      <a
        href="https://reddit.com/submit?url={encodedUrl}&title={encodedTitle}"
        target="_blank"
        rel="noopener noreferrer"
      >
        <IconButton ariaLabel="Share on Reddit" variant="default" size="lg">
          <i class="bi bi-reddit text-lg text-[#ff4500]" aria-hidden="true"></i>
        </IconButton>
      </a>
    </div>
  </div>

  {#snippet footer()}
    <Button variant="ghost" size="md" onclick={onClose}>
      <span class="inline-flex items-center gap-1.5">
        <span>Close</span>
        <kbd
          class="hidden items-center rounded border border-border-subtle/80 bg-surface-elevated/80 px-1 py-0.5 font-mono text-[9px] leading-none text-text-muted select-none sm:inline-flex"
        >
          Esc
        </kbd>
      </span>
    </Button>
  {/snippet}
</Dialog>
