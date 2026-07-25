<!-- @format -->
<script lang="ts">
  import {page} from '$app/state'
  import {Button, SkipLink} from '$lib'
</script>

<SkipLink />

<main
  id="main-content"
  class="grid min-h-[80vh] place-items-center px-6 py-24 font-sans sm:py-32 lg:px-8"
>
  <div class="text-center">
    <p class="text-base font-semibold text-copilot">{page.status}</p>
    <h1
      class="mt-4 text-5xl font-semibold tracking-tight text-balance text-text-primary sm:text-7xl"
    >
      {page.status === 404 ? 'Page not found' : 'An error occurred'}
    </h1>
    <p
      class="mt-6 text-lg font-medium text-pretty text-text-secondary sm:text-xl/8"
    >
      {page.error?.message
        || 'Sorry, we couldn’t find the page you’re looking for.'}
    </p>
    <div class="mt-10 flex items-center justify-center gap-x-6">
      <a href="/">
        <Button variant="primary" size="md">Go back home</Button>
      </a>
    </div>
  </div>
</main>
