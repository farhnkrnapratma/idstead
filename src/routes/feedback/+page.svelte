<script lang="ts">
  import {page} from '$app/state';
  import {onMount} from 'svelte';
  import {
    PenLine,
    Code2,
    ClockFading,
    Link2Off,
    Bug,
    HelpCircle,
    MessageSquareWarning
  } from '@lucide/svelte';
  import {
    isNameReserved,
    extractAuthorNameTokens
  } from '$lib/utils/nameValidator';
  import {
    Card,
    FormField,
    Input,
    Textarea,
    Button,
    TopNav,
    FooterSection,
    Section,
    PageContainer,
    ConsentNotice,
    Badge,
    toastStore
  } from '$lib';
  import {
    turnstileWidget,
    executeTurnstile,
    resetTurnstile,
    turnstileSiteKey
  } from '$lib/utils/turnstile';

  let pageAuthor = $derived((page?.data as any)?.author);
  let pageProjects = $derived((page?.data as any)?.projects ?? []);
  let authorName = $derived(pageAuthor?.name || '');
  let authorTokens = $derived(extractAuthorNameTokens(pageAuthor));
  let siteUrl = $derived(
    ((page?.data as any)?.author?.siteUrl || '').replace(/\/$/, '')
  );
  let contactEmail = $derived(
    (page?.data as any)?.contactEmail || pageAuthor?.email || ''
  );

  let formName = $state('');
  let formEmail = $state('');
  let formUrl = $state('');
  let formMessage = $state('');

  let formErrors = $state({name: '', email: '', url: '', message: ''});
  let formValid = $state({
    name: false,
    email: false,
    url: false,
    message: false
  });

  let isSubmitting = $state(false);
  let turnstileFeedbackEl = $state<HTMLDivElement | null>(null);

  const canClearFeedback = $derived(
    Boolean(
      formName.trim()
      || formEmail.trim()
      || formUrl.trim()
      || formMessage.trim()
    )
  );

  function clearFeedbackForm() {
    formName = '';
    formEmail = '';
    formUrl = '';
    formMessage = '';
    formErrors = {name: '', email: '', url: '', message: ''};
    formValid = {name: false, email: false, url: false, message: false};
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function debounce<T extends unknown[]>(cb: (...args: T) => void, ms: number) {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: T) => {
      clearTimeout(timer);
      timer = setTimeout(() => cb(...args), ms);
    };
  }

  const validateName = debounce(() => {
    const val = formName.trim();
    if (val === '') {
      formErrors.name = '';
      formValid.name = false;
    } else if (isNameReserved(val, authorTokens)) {
      formErrors.name = 'This name cannot be used. Please use another name.';
      formValid.name = false;
    } else {
      formErrors.name = '';
      formValid.name = true;
    }
  }, 500);

  const validateEmail = debounce(() => {
    const val = formEmail.trim();
    if (val === '') {
      formErrors.email = '';
      formValid.email = false;
    } else if (!emailRegex.test(val)) {
      formErrors.email = 'Please enter a valid email address.';
      formValid.email = false;
    } else {
      formErrors.email = '';
      formValid.email = true;
    }
  }, 500);

  const validateUrl = debounce(() => {
    const val = formUrl.trim();
    if (val === '') {
      formErrors.url = '';
      formValid.url = false;
    } else {
      formErrors.url = '';
      formValid.url = true;
    }
  }, 500);

  const validateMessage = debounce(() => {
    const val = formMessage.trim();
    if (val === '') {
      formErrors.message = '';
      formValid.message = false;
    } else {
      formErrors.message = '';
      formValid.message = true;
    }
  }, 500);

  function selectCategory(categoryTitle: string) {
    const prefix = `[${categoryTitle}] `;
    if (!formMessage.startsWith('[')) {
      formMessage = prefix + formMessage;
    } else {
      formMessage = formMessage.replace(/^\[[^\]]*\]\s*/, prefix);
    }
    formErrors.message = '';
    validateMessage();
    const textarea = document.getElementById(
      'form-message'
    ) as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.focus();
      textarea.scrollIntoView({behavior: 'smooth', block: 'center'});
    }
  }

  function sanitizeInput(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();

    const nameErr = formName.trim() === '' ? 'Name is required.' : '';
    const emailErr = formEmail.trim() === '' ? 'Email is required.' : '';
    const urlErr = formUrl.trim() === '' ? 'URL/Page is required.' : '';
    const msgErr = formMessage.trim() === '' ? 'Message is required.' : '';

    const emailFormatErr =
      !emailErr && !emailRegex.test(formEmail.trim()) ?
        'Please enter a valid email address.'
      : '';
    const nameReservedErr =
      !nameErr && isNameReserved(formName, authorTokens) ?
        'This name cannot be used. Please use another name.'
      : '';

    formErrors = {
      name: nameErr || nameReservedErr,
      email: emailErr || emailFormatErr,
      url: urlErr,
      message: msgErr
    };

    if (formErrors.name) formValid.name = false;
    if (formErrors.email) formValid.email = false;
    if (formErrors.url) formValid.url = false;
    if (formErrors.message) formValid.message = false;

    if (
      formErrors.name
      || formErrors.email
      || formErrors.url
      || formErrors.message
    ) {
      return;
    }

    if (!contactEmail) {
      toastStore.error('Feedback submission is currently unavailable.');
      return;
    }

    isSubmitting = true;

    try {
      if (turnstileSiteKey) {
        const token = await executeTurnstile(turnstileFeedbackEl);
        if (!token) {
          toastStore.error('Please complete the security verification.');
          return;
        }
      }

      const sanitizedName = sanitizeInput(formName.trim());
      const sanitizedEmail = sanitizeInput(formEmail.trim());
      const sanitizedUrl = sanitizeInput(formUrl.trim());
      const sanitizedMessage = sanitizeInput(formMessage.trim());

      const res = await fetch(
        `https://formsubmit.co/ajax/${encodeURIComponent(contactEmail)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          referrerPolicy: 'no-referrer-when-downgrade',
          body: JSON.stringify({
            name: sanitizedName,
            email: sanitizedEmail,
            url: sanitizedUrl,
            message: sanitizedMessage,
            _subject: 'New feedback report from website!',
            _captcha: 'false'
          })
        }
      );

      const data = await res.json().catch(() => null);
      if (!res.ok || data?.success === 'false' || data?.success === false) {
        throw new Error(
          typeof data?.message === 'string' ?
            data.message
          : 'Failed to submit feedback.'
        );
      }

      toastStore.success('Feedback submitted successfully. Thank you!');
      formName = '';
      formEmail = '';
      formUrl = '';
      formMessage = '';
      formErrors = {name: '', email: '', url: '', message: ''};
      formValid = {name: false, email: false, url: false, message: false};
    } catch (err) {
      const msg =
        err instanceof Error && err.message ?
          err.message
        : 'Failed to submit feedback. Please try again later.';
      toastStore.error(msg);
    } finally {
      isSubmitting = false;
      resetTurnstile(turnstileFeedbackEl);
    }
  }
</script>

<svelte:head>
  <title>Feedback{authorName ? ` — ${authorName}` : ''}</title>
  <script
    src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
    async
    defer></script>
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
  backLabel="Home"
  projects={pageProjects} />

<main
  id="main-content"
  class="flex min-h-[calc(100vh-3rem)] flex-col pt-12 font-sans sm:min-h-[calc(100vh-3.5rem)] sm:pt-14">
  <Section
    spacing="none"
    class="relative z-10 pt-5 pb-6 md:pt-8 md:pb-8">
    <PageContainer
      width="standard"
      class="flex flex-col gap-8">
      <div
        class="pointer-events-none absolute top-12.5 left-[50%] z-0 h-80 w-[320px] translate-x-[-50%] rounded-full bg-accent/10 blur-[80px]">
      </div>

      <div
        class="relative z-10 flex flex-col items-start text-left select-none">
        <Badge
          variant="accent"
          size="sm"
          class="mb-3">
          <MessageSquareWarning class="size-3" />
          Feedback & Reports
        </Badge>
        <h1
          class="font-sans-title text-3xl font-bold tracking-tight text-text-primary md:text-4xl lg:text-5xl">
          Your feedback matters
        </h1>
        <p class="mt-4 max-w-2xl text-base leading-relaxed text-text-secondary">
          Your valuable feedback helps improve the quality of articles and
          ensures the website's technical systems run reliably. Please let me
          know if you spot any issues.
        </p>
      </div>

      <Card
        variant="glass"
        class="relative z-10 p-5 select-none">
        <div class="flex flex-col gap-3.5">
          <div class="flex flex-col">
            <h2 class="font-sans-title text-sm font-bold text-text-primary">
              Feedback categories
            </h2>
            <p class="mt-0.5 text-xs text-text-muted">
              Click any category to quickly populate your message below.
            </p>
          </div>

          <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onclick={() => selectCategory('Writing error')}
              class="group flex cursor-pointer flex-col gap-1.5 rounded-md border border-border-subtle/70 bg-surface-card/40 p-3.5 text-left transition-all hover:border-accent/40 hover:bg-surface-card/80 focus-visible:border-accent focus-visible:outline-none"
              aria-label="Select category: Writing errors">
              <div class="flex items-center gap-2">
                <PenLine
                  class="size-4 shrink-0 text-accent transition-transform group-hover:scale-105" />
                <span
                  class="translate-y-[0.5px] font-sans-title text-sm leading-none font-semibold text-text-primary transition-colors group-hover:text-accent">
                  Writing errors
                </span>
              </div>
              <p class="text-xs leading-relaxed text-text-secondary">
                Grammatical mistakes, typos, spelling, poor phrasing, or error
                translating.
              </p>
            </button>

            <button
              type="button"
              onclick={() => selectCategory('Technical inaccuracy')}
              class="group flex cursor-pointer flex-col gap-1.5 rounded-md border border-border-subtle/70 bg-surface-card/40 p-3.5 text-left transition-all hover:border-accent/40 hover:bg-surface-card/80 focus-visible:border-accent focus-visible:outline-none"
              aria-label="Select category: Technical inaccuracies">
              <div class="flex items-center gap-2">
                <Code2
                  class="size-4 shrink-0 text-accent transition-transform group-hover:scale-105" />
                <span
                  class="translate-y-[0.5px] font-sans-title text-sm leading-none font-semibold text-text-primary transition-colors group-hover:text-accent">
                  Technical inaccuracies
                </span>
              </div>
              <p class="text-xs leading-relaxed text-text-secondary">
                Code snippets that don't compile, wrong command usages, or
                faulty explanation logic.
              </p>
            </button>

            <button
              type="button"
              onclick={() => selectCategory('Outdated information')}
              class="group flex cursor-pointer flex-col gap-1.5 rounded-md border border-border-subtle/70 bg-surface-card/40 p-3.5 text-left transition-all hover:border-accent/40 hover:bg-surface-card/80 focus-visible:border-accent focus-visible:outline-none"
              aria-label="Select category: Outdated information">
              <div class="flex items-center gap-2">
                <ClockFading
                  class="size-4 shrink-0 text-accent transition-transform group-hover:scale-105" />
                <span
                  class="translate-y-[0.5px] font-sans-title text-sm leading-none font-semibold text-text-primary transition-colors group-hover:text-accent">
                  Outdated information
                </span>
              </div>
              <p class="text-xs leading-relaxed text-text-secondary">
                Deprecated package API calls, tools that are no longer active,
                or outdated tutorial steps.
              </p>
            </button>

            <button
              type="button"
              onclick={() => selectCategory('Broken link')}
              class="group flex cursor-pointer flex-col gap-1.5 rounded-md border border-border-subtle/70 bg-surface-card/40 p-3.5 text-left transition-all hover:border-accent/40 hover:bg-surface-card/80 focus-visible:border-accent focus-visible:outline-none"
              aria-label="Select category: Broken links">
              <div class="flex items-center gap-2">
                <Link2Off
                  class="size-4 shrink-0 text-accent transition-transform group-hover:scale-105" />
                <span
                  class="translate-y-[0.5px] font-sans-title text-sm leading-none font-semibold text-text-primary transition-colors group-hover:text-accent">
                  Broken links
                </span>
              </div>
              <p class="text-xs leading-relaxed text-text-secondary">
                404 links, invalid references, or missing static download files.
              </p>
            </button>

            <button
              type="button"
              onclick={() => selectCategory('Website issue')}
              class="group flex cursor-pointer flex-col gap-1.5 rounded-md border border-border-subtle/70 bg-surface-card/40 p-3.5 text-left transition-all hover:border-accent/40 hover:bg-surface-card/80 focus-visible:border-accent focus-visible:outline-none"
              aria-label="Select category: Website issues">
              <div class="flex items-center gap-2">
                <Bug
                  class="size-4 shrink-0 text-accent transition-transform group-hover:scale-105" />
                <span
                  class="translate-y-[0.5px] font-sans-title text-sm leading-none font-semibold text-text-primary transition-colors group-hover:text-accent">
                  Website issues
                </span>
              </div>
              <p class="text-xs leading-relaxed text-text-secondary">
                UI layout bugs, visual display mistakes, broken styling, or slow
                loading times.
              </p>
            </button>

            <button
              type="button"
              onclick={() => selectCategory('Other issue')}
              class="group flex cursor-pointer flex-col gap-1.5 rounded-md border border-border-subtle/70 bg-surface-card/40 p-3.5 text-left transition-all hover:border-accent/40 hover:bg-surface-card/80 focus-visible:border-accent focus-visible:outline-none"
              aria-label="Select category: Other issues">
              <div class="flex items-center gap-2">
                <HelpCircle
                  class="size-4 shrink-0 text-accent transition-transform group-hover:scale-105" />
                <span
                  class="translate-y-[0.5px] font-sans-title text-sm leading-none font-semibold text-text-primary transition-colors group-hover:text-accent">
                  Other issues
                </span>
              </div>
              <p class="text-xs leading-relaxed text-text-secondary">
                General inquiries, suggestions, content ideas, or feedback
                outside listed categories.
              </p>
            </button>
          </div>
        </div>
      </Card>

      <form
        novalidate
        onsubmit={handleSubmit}
        class="relative z-10 flex w-full flex-col gap-3 rounded-md glass-card p-6 text-left"
        autocomplete="off">
        <div class="mb-2 select-none">
          <h2 class="font-sans-title text-sm font-bold text-text-primary">
            Report an issue
          </h2>
          <p class="mt-0.5 text-xs text-text-muted">
            Complete the fields below to submit your feedback directly.
          </p>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            id="form-name"
            label="Name"
            variant="floating"
            required
            hideAsterisk
            maxlength={50}
            currentLength={formName.length}
            error={formErrors.name}
            valid={formValid.name}>
            <Input
              type="text"
              id="form-name"
              name="name"
              autocomplete="name"
              maxlength={50}
              bind:value={formName}
              error={!!formErrors.name}
              valid={formValid.name}
              oninput={() => {
                formErrors.name = '';
                formValid.name = false;
                validateName();
              }} />
          </FormField>

          <FormField
            id="form-email"
            label="Email"
            variant="floating"
            required
            hideAsterisk
            maxlength={100}
            currentLength={formEmail.length}
            error={formErrors.email}
            valid={formValid.email}>
            <Input
              type="text"
              id="form-email"
              name="email"
              autocomplete="email"
              maxlength={100}
              bind:value={formEmail}
              error={!!formErrors.email}
              valid={formValid.email}
              oninput={() => {
                formErrors.email = '';
                formValid.email = false;
                validateEmail();
              }} />
          </FormField>
        </div>

        <FormField
          id="form-url"
          label="Which URL/page contains the issue?"
          variant="floating"
          required
          hideAsterisk
          maxlength={200}
          currentLength={formUrl.length}
          error={formErrors.url}
          valid={formValid.url}>
          <Input
            type="text"
            id="form-url"
            name="url"
            maxlength={200}
            bind:value={formUrl}
            error={!!formErrors.url}
            valid={formValid.url}
            oninput={() => {
              formErrors.url = '';
              formValid.url = false;
              validateUrl();
            }} />
        </FormField>

        <FormField
          id="form-message"
          label="Message"
          variant="floating"
          required
          hideAsterisk
          maxlength={2000}
          currentLength={formMessage.length}
          counter={`${formMessage.length}/2000`}
          error={formErrors.message}
          valid={formValid.message}>
          <Textarea
            id="form-message"
            name="message"
            rows={4}
            maxlength={2000}
            bind:value={formMessage}
            error={!!formErrors.message}
            valid={formValid.message}
            oninput={() => {
              formErrors.message = '';
              formValid.message = false;
              validateMessage();
            }} />
        </FormField>

        {#if turnstileSiteKey}
          <div
            bind:this={turnstileFeedbackEl}
            class="cf-turnstile select-none"
            data-sitekey={turnstileSiteKey}
            data-action="feedback"
            data-size="flexible"
            data-theme="auto"
            data-appearance="interaction-only"
            data-execution="execute"
            use:turnstileWidget={{
              sitekey: turnstileSiteKey,
              action: 'feedback',
              size: 'flexible',
              theme: 'auto',
              appearance: 'interaction-only',
              execution: 'execute'
            }}>
          </div>
        {/if}

        <ConsentNotice action="submitting this feedback report" />

        <div class="mt-2 flex items-center justify-between gap-2 select-none">
          <Button
            htmlType="button"
            type="outline"
            tone="critical"
            size="md"
            class="flex-1 sm:flex-initial"
            disabled={!canClearFeedback || isSubmitting}
            onclick={clearFeedbackForm}>
            <span
              >Clear<span class="hidden sm:inline">&nbsp;feedback</span></span>
          </Button>
          <Button
            htmlType="submit"
            type="primary"
            size="md"
            class="flex-1 sm:flex-initial"
            disabled={isSubmitting}
            isLoading={isSubmitting}>
            {isSubmitting ? 'Submitting…' : 'Submit feedback'}
          </Button>
        </div>
      </form>
    </PageContainer>
  </Section>

  <FooterSection />
</main>
