<!-- @format -->
<script lang="ts">
  import {page} from '$app/state'
  import {Button, SkipLink, ErrorState, FooterLegalRow} from '$lib'

  let pageAuthor = $derived((page?.data as any)?.author)
  let name = $derived(pageAuthor?.name || '')
  let fallbackMessage = $derived(
    page.status === 404 ?
      'Sorry, we couldn’t find the page you’re looking for.'
    : 'Sorry, something went wrong on our end.'
  )
</script>

<SkipLink />

<div class="flex min-h-screen flex-col">
  <main
    id="main-content"
    class="my-auto grid place-items-center px-6 py-16 font-sans sm:py-24 lg:px-8">
    <ErrorState
      size="page"
      code={page.status}
      title={page.status === 404 ? 'Page not found' : 'An error occurred'}
      description={page.error?.message || fallbackMessage}>
      {#snippet actions()}
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
      {/snippet}
    </ErrorState>
  </main>

  <footer class="py-6 text-center select-none">
    <FooterLegalRow {name} />
  </footer>
</div>
