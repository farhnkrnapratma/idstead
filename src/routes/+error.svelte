<!-- @format -->
<script lang="ts">
  import {page} from '$app/state'
  import {Button, SkipLink, ShinyText} from '$lib'
  import {consentStore} from '$lib/stores/consentStore.svelte'

  let pageAuthor = $derived((page?.data as any)?.author)
  let name = $derived(pageAuthor?.name || '')
</script>

<SkipLink />

<div class="flex min-h-screen flex-col">
  <main
    id="main-content"
    class="my-auto grid place-items-center px-6 py-16 font-sans sm:py-24 lg:px-8">
    <div class="text-center">
      <p
        class="font-mono text-5xl font-extrabold tracking-widest select-none sm:text-7xl md:text-8xl">
        <ShinyText
          text={String(page.status)}
          color="var(--color-copilot)"
          shineColor="var(--color-surface-card)"
          speed={1.5} />
      </p>
      <h1
        class="mt-4 text-2xl font-semibold tracking-tight text-balance text-text-primary sm:text-4xl">
        {page.status === 404 ? 'Page not found' : 'An error occurred'}
      </h1>
      <p
        class="mt-6 text-lg font-medium text-pretty text-text-secondary sm:text-xl md:text-2xl">
        {page.error?.message
          || 'Sorry, we couldn’t find the page you’re looking for.'}
      </p>
      <div
        class="mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
        <a href="/">
          <Button
            variant="primary"
            size="md">Go back home</Button>
        </a>
        <a href="/feedback">
          <Button
            variant="secondary"
            size="md">
            Feedback
          </Button>
        </a>
      </div>
    </div>
  </main>

  <footer class="py-6 text-center select-none">
    <div
      class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-medium text-text-muted">
      <span class="inline-flex shrink-0 items-center text-text-muted">
        &copy; {new Date().getFullYear()}
        {name}.
      </span>
      <a
        href="/privacy"
        class="inline-flex shrink-0 items-center transition-colors hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-none">
        Privacy
      </a>
      <button
        type="button"
        onclick={() => consentStore.openCustomizeModal()}
        class="inline-flex shrink-0 cursor-pointer items-center transition-colors hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-none">
        Manage cookies
      </button>
      <a
        href="/sitemap.xml"
        class="inline-flex shrink-0 items-center transition-colors hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-none">
        Sitemap
      </a>
      <a
        href="/atom.xml"
        class="inline-flex shrink-0 items-center transition-colors hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-none">
        RSS
      </a>
    </div>
  </footer>
</div>
