<!-- @format -->
<script lang="ts">
  import {page} from '$app/state'
  import {onMount} from 'svelte'
  import {isNameReserved} from '$lib/utils/nameValidator'
  import {
    Card,
    FormField,
    Input,
    Textarea,
    Button,
    Dialog,
    TopNav,
    FooterSection
  } from '$lib'

  let pageAuthor = $derived((page?.data as any)?.author)
  let authorName = $derived(pageAuthor?.name || '')
  let siteUrl = $derived(
    ((page?.data as any)?.author?.siteUrl || page.url.origin).replace(/\/$/, '')
  )
  let contactEmail = $derived(pageAuthor?.email || '')

  let formName = $state('')
  let formEmail = $state('')
  let formUrl = $state('')
  let formMessage = $state('')

  let formErrors = $state({name: '', email: '', url: '', message: ''})
  let formValid = $state({
    name: false,
    email: false,
    url: false,
    message: false
  })

  let showSubmitDialog = $state(false)
  let feedbackFormElement = $state<HTMLFormElement | null>(null)

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  function debounce<T extends unknown[]>(cb: (...args: T) => void, ms: number) {
    let timer: ReturnType<typeof setTimeout>
    return (...args: T) => {
      clearTimeout(timer)
      timer = setTimeout(() => cb(...args), ms)
    }
  }

  const validateName = debounce(() => {
    const val = formName.trim()
    if (val === '') {
      formErrors.name = ''
      formValid.name = false
    } else if (isNameReserved(val)) {
      formErrors.name = 'This name cannot be used. Please use another name.'
      formValid.name = false
    } else {
      formErrors.name = ''
      formValid.name = true
    }
  }, 500)

  const validateEmail = debounce(() => {
    const val = formEmail.trim()
    if (val === '') {
      formErrors.email = ''
      formValid.email = false
    } else if (!emailRegex.test(val)) {
      formErrors.email = 'Please enter a valid email address.'
      formValid.email = false
    } else {
      formErrors.email = ''
      formValid.email = true
    }
  }, 500)

  const validateUrl = debounce(() => {
    const val = formUrl.trim()
    if (val === '') {
      formErrors.url = ''
      formValid.url = false
    } else {
      formErrors.url = ''
      formValid.url = true
    }
  }, 500)

  const validateMessage = debounce(() => {
    const val = formMessage.trim()
    if (val === '') {
      formErrors.message = ''
      formValid.message = false
    } else {
      formErrors.message = ''
      formValid.message = true
    }
  }, 500)

  function sanitizeInput(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  }

  function validateForm(e: Event) {
    const nameErr = formName.trim() === '' ? 'Name is required.' : ''
    const emailErr = formEmail.trim() === '' ? 'Email is required.' : ''
    const urlErr = formUrl.trim() === '' ? 'URL/Page is required.' : ''
    const msgErr = formMessage.trim() === '' ? 'Message is required.' : ''

    const emailFormatErr =
      !emailErr && !emailRegex.test(formEmail.trim()) ?
        'Please enter a valid email address.'
      : ''
    const nameReservedErr =
      !nameErr && isNameReserved(formName) ?
        'This name cannot be used. Please use another name.'
      : ''

    formErrors = {
      name: nameErr || nameReservedErr,
      email: emailErr || emailFormatErr,
      url: urlErr,
      message: msgErr
    }

    if (formErrors.name) formValid.name = false
    if (formErrors.email) formValid.email = false
    if (formErrors.url) formValid.url = false
    if (formErrors.message) formValid.message = false

    e.preventDefault()

    if (
      !formErrors.name
      && !formErrors.email
      && !formErrors.url
      && !formErrors.message
    ) {
      formName = sanitizeInput(formName.trim())
      formEmail = sanitizeInput(formEmail.trim())
      formUrl = sanitizeInput(formUrl.trim())
      formMessage = sanitizeInput(formMessage.trim())
      showSubmitDialog = true
    }
  }

  function executeSubmit() {
    if (feedbackFormElement) {
      feedbackFormElement.submit()
    }
  }
</script>

<svelte:head>
  <title>Feedback{authorName ? ` — ${authorName}` : ''}</title>
  <meta
    name="description"
    content="Send feedback, suggestions, or comments{authorName ?
      ` directly to ${authorName}.`
    : '.'}" />
  <link
    rel="canonical"
    href="{siteUrl}/feedback" />
  <meta
    property="og:title"
    content="Feedback{authorName ? ` — ${authorName}` : ''}" />
  <meta
    property="og:description"
    content="Send feedback, suggestions, or comments{authorName ?
      ` directly to ${authorName}.`
    : '.'}" />
  <meta
    property="og:type"
    content="website" />
  <meta
    property="og:url"
    content="{siteUrl}/feedback" />
  <meta
    property="og:image"
    content="{siteUrl}/hero.png" />
  <meta
    name="twitter:card"
    content="summary_large_image" />
  <meta
    name="twitter:title"
    content="Feedback{authorName ? ` — ${authorName}` : ''}" />
  <meta
    name="twitter:description"
    content="Send feedback, suggestions, or comments{authorName ?
      ` directly to ${authorName}.`
    : '.'}" />
  <meta
    name="twitter:image"
    content="{siteUrl}/hero.png" />
</svelte:head>

<TopNav
  ariaLabel="Feedback page navigation"
  backHref="/"
  backLabel="Back to Home" />

<main
  id="main-content"
  class="flex min-h-[calc(100vh-3.75rem)] flex-col pt-15 font-sans">
  <section
    class="relative z-10 mx-auto flex w-full flex-col gap-8 px-6 py-12 md:w-[80%] lg:w-[60%] xl:w-[50%]">
    <div
      class="pointer-events-none absolute top-12.5 left-[50%] z-0 h-80 w-[320px] translate-x-[-50%] rounded-full bg-copilot/10 blur-[80px]">
    </div>

    <div class="relative z-10 text-center select-none">
      <h1
        class="text-3xl font-bold tracking-tight text-text-primary md:text-4xl lg:text-5xl">
        Your feedback matters
      </h1>
      <p
        class="mx-auto mt-4 max-w-xl text-base leading-relaxed text-text-secondary">
        Your valuable feedback helps improve the quality of articles and ensures
        the website's technical systems run reliably. Please let us know if you
        spot any issues.
      </p>
    </div>

    <Card
      variant="glass"
      class="relative z-10 p-5 select-none">
      <div class="flex flex-col gap-3">
        <h2 class="text-sm font-bold text-text-primary">Feedback categories</h2>
        <ul class="flex flex-col gap-2.5 text-xs text-text-secondary">
          <li class="flex items-start gap-2">
            <i
              class="bi bi-check-circle-fill mt-0.5 text-copilot"
              aria-hidden="true"></i>
            <span
              ><strong>Writing errors:</strong> Grammatical mistakes, typos, spelling,
              or poor phrasing.</span>
          </li>
          <li class="flex items-start gap-2">
            <i
              class="bi bi-check-circle-fill mt-0.5 text-copilot"
              aria-hidden="true"></i>
            <span
              ><strong>Technical inaccuracies:</strong> Code snippets that don't compile,
              wrong command usages, or faulty explanation logic.</span>
          </li>
          <li class="flex items-start gap-2">
            <i
              class="bi bi-check-circle-fill mt-0.5 text-copilot"
              aria-hidden="true"></i>
            <span
              ><strong>Outdated information:</strong> Deprecated package API calls,
              tools that are no longer active, or outdated tutorial steps.</span>
          </li>
          <li class="flex items-start gap-2">
            <i
              class="bi bi-check-circle-fill mt-0.5 text-copilot"
              aria-hidden="true"></i>
            <span
              ><strong>Broken links:</strong> 404 links, invalid references, or missing
              static download files.</span>
          </li>
          <li class="flex items-start gap-2">
            <i
              class="bi bi-check-circle-fill mt-0.5 text-copilot"
              aria-hidden="true"></i>
            <span
              ><strong>Website issues:</strong> UI layout bugs, visual display mistakes,
              broken styling, accessibility complaints, or slow loading times.</span>
          </li>
        </ul>
      </div>
    </Card>

    <form
      bind:this={feedbackFormElement}
      novalidate
      action={contactEmail ? `https://formsubmit.co/${contactEmail}` : '#'}
      method="POST"
      onsubmit={validateForm}
      class="relative z-10 flex w-full flex-col gap-3 rounded-sm border border-border-subtle bg-surface-card/45 p-6 text-left shadow-xs backdrop-blur-xl transition-colors duration-300"
      autocomplete="off">
      <input
        type="hidden"
        name="_subject"
        value="New feedback report from website!" />
      <input
        type="hidden"
        name="_template"
        value="table" />
      <input
        type="hidden"
        name="_captcha"
        value="true" />
      <input
        type="hidden"
        name="_url"
        value="{siteUrl}/feedback" />

      <div class="mb-2 select-none">
        <h2 class="text-sm font-bold text-text-primary">Report an issue</h2>
        <p class="mt-0.5 text-xs text-text-muted">
          Complete the fields below to submit your feedback directly.
        </p>
      </div>

      <FormField
        id="form-name"
        label="Name"
        required
        error={formErrors.name}
        valid={formValid.name}>
        <Input
          type="text"
          id="form-name"
          name="name"
          aria-required="true"
          autocomplete="name"
          placeholder="Enter your name"
          bind:value={formName}
          error={!!formErrors.name}
          valid={formValid.name}
          oninput={() => {
            formErrors.name = ''
            formValid.name = false
            validateName()
          }} />
      </FormField>

      <FormField
        id="form-email"
        label="Email"
        required
        error={formErrors.email}
        valid={formValid.email}>
        <Input
          type="text"
          id="form-email"
          name="email"
          aria-required="true"
          autocomplete="email"
          placeholder="Enter your email"
          bind:value={formEmail}
          error={!!formErrors.email}
          valid={formValid.email}
          oninput={() => {
            formErrors.email = ''
            formValid.email = false
            validateEmail()
          }} />
      </FormField>

      <FormField
        id="form-url"
        label="Which URL/page contains the issue?"
        required
        error={formErrors.url}
        valid={formValid.url}>
        <Input
          type="text"
          id="form-url"
          name="url"
          aria-required="true"
          placeholder="Enter page path or full URL (e.g. Home, Blog, or link)"
          bind:value={formUrl}
          error={!!formErrors.url}
          valid={formValid.url}
          oninput={() => {
            formErrors.url = ''
            formValid.url = false
            validateUrl()
          }} />
      </FormField>

      <FormField
        id="form-message"
        label="Message"
        required
        error={formErrors.message}
        valid={formValid.message}
        counter="{2000 - formMessage.length} left">
        <Textarea
          id="form-message"
          name="message"
          rows={4}
          maxlength={2000}
          placeholder="Describe the issue in detail…"
          bind:value={formMessage}
          error={!!formErrors.message}
          valid={formValid.message}
          oninput={() => {
            formErrors.message = ''
            formValid.message = false
            validateMessage()
          }} />
      </FormField>

      <div class="mt-2 flex justify-end select-none">
        <Button
          type="submit"
          variant="primary"
          size="md">
          Submit feedback
        </Button>
      </div>
    </form>
  </section>

  <FooterSection />
</main>

<Dialog
  bind:isOpen={showSubmitDialog}
  title="Submit feedback?"
  description="Are you sure you want to submit this feedback report?"
  onClose={() => (showSubmitDialog = false)}>
  {#snippet footer()}
    <Button
      variant="secondary"
      size="md"
      showEscHint
      onclick={() => (showSubmitDialog = false)}>
      Cancel
    </Button>
    <Button
      variant="primary"
      size="md"
      onclick={executeSubmit}>
      Submit feedback
    </Button>
  {/snippet}
</Dialog>
