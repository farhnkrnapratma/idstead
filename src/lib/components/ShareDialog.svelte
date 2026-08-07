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
    showEmail?: boolean
    onClose: () => void
    class?: string
  }

  let {
    isOpen = $bindable(false),
    title = 'Share this Article',
    url = typeof window !== 'undefined' ? window.location.href : '',
    articleTitle = '',
    showEmail = false,
    onClose,
    class: className = ''
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
  class={className}
  {onClose}>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-2">
      <Input
        type="text"
        readonly
        value={url
          || (typeof window !== 'undefined' ? window.location.href : '')}
        class="font-mono text-xs select-all" />
      <Button
        variant={copied ? 'subtle' : 'secondary'}
        size="md"
        onclick={copyUrl}>
        {#if copied}
          <i
            class="bi bi-check2 text-copilot"
            aria-hidden="true"></i> Copied!
        {:else}
          <i
            class="bi bi-clipboard"
            aria-hidden="true"></i> Copy
        {/if}
      </Button>
    </div>

    <div class="flex items-center justify-center gap-3 pt-2">
      <a
        href="https://x.com/intent/post?url={encodedUrl}&text={encodedTitle}"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X (opens in a new tab)"
        title="Share on X (opens in a new tab)">
        <IconButton
          ariaLabel="Share on X"
          variant="default"
          size="lg">
          <i
            class="bi bi-twitter-x text-lg"
            aria-hidden="true"></i>
        </IconButton>
      </a>

      <a
        href="https://linkedin.com/sharing/share-offsite/?url={encodedUrl}"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on LinkedIn (opens in a new tab)"
        title="Share on LinkedIn (opens in a new tab)">
        <IconButton
          ariaLabel="Share on LinkedIn"
          variant="default"
          size="lg">
          <i
            class="bi bi-linkedin text-lg text-(--color-brand-linkedin)"
            aria-hidden="true"></i>
        </IconButton>
      </a>

      <a
        href="https://www.facebook.com/sharer/sharer.php?u={encodedUrl}"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on Facebook (opens in a new tab)"
        title="Share on Facebook (opens in a new tab)">
        <IconButton
          ariaLabel="Share on Facebook"
          variant="default"
          size="lg">
          <i
            class="bi bi-facebook text-lg text-(--color-brand-facebook)"
            aria-hidden="true"></i>
        </IconButton>
      </a>

      <a
        href="https://reddit.com/submit?url={encodedUrl}&title={encodedTitle}"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on Reddit (opens in a new tab)"
        title="Share on Reddit (opens in a new tab)">
        <IconButton
          ariaLabel="Share on Reddit"
          variant="default"
          size="lg">
          <i
            class="bi bi-reddit text-lg text-(--color-brand-reddit)"
            aria-hidden="true"></i>
        </IconButton>
      </a>

      {#if showEmail}
        <a
          href="mailto:?subject={encodedTitle}&body={encodedUrl}"
          aria-label="Share via email"
          title="Share via email">
          <IconButton
            ariaLabel="Share via email"
            variant="default"
            size="lg">
            <i
              class="bi bi-envelope-fill text-lg"
              aria-hidden="true"></i>
          </IconButton>
        </a>
      {/if}
    </div>
  </div>

  {#snippet footer()}
    <Button
      variant="ghost"
      size="md"
      onclick={onClose}>
      <span class="inline-flex items-center gap-1.5">
        <span>Close</span>
        <kbd
          class="hidden items-center rounded-sm border border-border-subtle/80 bg-surface-elevated/80 px-1 py-0.5 font-mono text-3xs leading-none text-text-muted select-none sm:inline-flex">
          Esc
        </kbd>
      </span>
    </Button>
  {/snippet}
</Dialog>
