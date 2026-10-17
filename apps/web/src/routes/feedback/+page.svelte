<script lang="ts">
    import { FieldValidation, requiredText, emailError } from '#lib/fieldValidation.ts';
    import { publicAvatarUrl, publicBannerOgUrl } from '#lib/siteIdentity.ts';
    import { page } from '$app/state';
    import { shortcut } from '#lib/utils/shortcut.svelte.ts';
    import { buttonKey } from '#lib/shortcuts.ts';
    import { onDestroy } from 'svelte';
    import {
        PenLine,
        Code2,
        ClockFading,
        Link2Off,
        Bug,
        HelpCircle,
        MessageSquareWarning
    } from '@lucide/svelte';
    import { isNameReserved, extractAuthorNameTokens } from '#lib/utils/nameValidator.ts';
    import {
        Card,
        FormField,
        Input,
        Textarea,
        Button,
        SkipLink,
        TopNav,
        FooterSection,
        Section,
        PageContainer,
        ConsentNotice,
        Badge,
        toastStore
    } from '#lib/index.ts';
    import {
        turnstileWidget,
        executeTurnstile,
        resetTurnstile,
        turnstileSiteKey
    } from '#lib/utils/turnstile.ts';

    let pageAuthor = $derived((page?.data as any)?.author);
    let pageProjects = $derived((page?.data as any)?.projects ?? []);
    let authorName = $derived(pageAuthor?.name || '');
    let authorTokens = $derived(extractAuthorNameTokens(pageAuthor));
    let siteUrl = $derived(((page?.data as any)?.author?.siteUrl || '').replace(/\/$/, ''));
    let ogBanner = $derived(publicBannerOgUrl(pageAuthor));
    let ogImage = $derived(ogBanner || publicAvatarUrl(pageAuthor));
    let ogImageType = $derived(ogBanner ? 'image/webp' : 'image/png');
    let ogImageWidth = $derived(ogBanner ? '1200' : '512');
    let ogImageHeight = $derived(ogBanner ? '630' : '512');
    let contactEmail = $derived((page?.data as any)?.contactEmail || pageAuthor?.email || '');

    let formName = $state('');
    let formEmail = $state('');
    let formUrl = $state('');
    let formMessage = $state('');

    let formErrors = $state({ name: '', email: '', url: '', message: '' });
    let formValid = $state({ name: false, email: false, url: false, message: false });

    let isSubmitting = $state(false);
    let turnstileFeedbackEl = $state<HTMLDivElement | null>(null);

    const canClearFeedback = $derived(
        Boolean(formName.trim() || formEmail.trim() || formUrl.trim() || formMessage.trim())
    );

    function clearFeedbackForm() {
        validation.reset();
        formName = '';
        formEmail = '';
        formUrl = '';
        formMessage = '';
        formErrors = { name: '', email: '', url: '', message: '' };
        formValid = { name: false, email: false, url: false, message: false };
        validation.reset();
    }

    const validation = new FieldValidation();
    onDestroy(() => validation.destroy());
    validation.register('name', {
        value: () => formName,
        baseline: () => '',
        validate: value =>
            requiredText('Name')(value)
            || (isNameReserved(value, authorTokens) ?
                'This name cannot be used. Please use another name.'
            :   ''),
        report: result => {
            formErrors.name = result.error;
            formValid.name = result.valid;
        }
    });
    validation.register('email', {
        value: () => formEmail,
        baseline: () => '',
        validate: emailError,
        report: result => {
            formErrors.email = result.error;
            formValid.email = result.valid;
        }
    });
    validation.register('message', {
        value: () => formMessage,
        baseline: () => '',
        validate: requiredText('Message'),
        report: result => {
            formErrors.message = result.error;
            formValid.message = result.valid;
        }
    });
    validation.register('url', {
        value: () => formUrl,
        baseline: () => '',
        validate: requiredText('URL/Page'),
        report: result => {
            formErrors.url = result.error;
            formValid.url = result.valid;
        }
    });
    function selectCategory(categoryTitle: string) {
        const prefix = `[${categoryTitle}] `;
        if (!formMessage.startsWith('[')) {
            formMessage = prefix + formMessage;
        } else {
            formMessage = formMessage.replace(/^\[[^\]]*\]\s*/, prefix);
        }
        formErrors.message = '';
        queueMicrotask(() => validation.input('message'));
        const textarea = document.getElementById('form-message') as HTMLTextAreaElement | null;
        if (textarea) {
            textarea.focus();
            textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();

        if (!(await validation.submit(undefined, true))) return;

        if (!contactEmail) {
            toastStore.error('Feedback submission is currently unavailable.');
            return;
        }

        isSubmitting = true;

        try {
            let turnstileToken = '';
            if (turnstileSiteKey) {
                const token = await executeTurnstile(turnstileFeedbackEl);
                if (!token) {
                    toastStore.error('Please complete the security verification.');
                    return;
                }
                turnstileToken = token;
            }

            const res = await fetch('/api/internal/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    kind: 'feedback',
                    name: formName.trim(),
                    email: formEmail.trim(),
                    url: formUrl.trim(),
                    message: formMessage.trim(),
                    turnstileToken
                })
            });

            const data = await res.json().catch(() => null);
            if (!res.ok || data?.success !== true) {
                throw new Error(
                    typeof data?.error?.message === 'string' ?
                        data.error.message
                    :   'Failed to submit feedback.'
                );
            }

            toastStore.success('Feedback submitted successfully. Thank you!');
            formName = '';
            formEmail = '';
            formUrl = '';
            formMessage = '';
            formErrors = { name: '', email: '', url: '', message: '' };
            formValid = { name: false, email: false, url: false, message: false };
            validation.reset();
        } catch (err) {
            const msg =
                err instanceof Error && err.message ?
                    err.message
                :   'Failed to submit feedback. Please try again later.';
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
        :   '.'}" />
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
        :   '.'}" />
    <meta
        property="og:type"
        content="website" />
    <meta
        property="og:url"
        content="{siteUrl}/feedback" />
    <meta
        property="og:image"
        content={ogImage} />
    <meta
        property="og:image:secure_url"
        content={ogImage} />
    <meta
        property="og:image:type"
        content={ogImageType} />
    <meta
        property="og:image:width"
        content={ogImageWidth} />
    <meta
        property="og:image:height"
        content={ogImageHeight} />
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
        :   '.'}" />
    <meta
        name="twitter:image"
        content={ogImage} />
</svelte:head>

<SkipLink />

<TopNav
    ariaLabel="Feedback page navigation"
    backHref="/"
    backLabel="Home"
    projects={pageProjects} />

<main
    id="main"
    class="flex min-h-[calc(100vh-4rem)] flex-col pt-16 font-sans sm:min-h-[calc(100vh-5rem)] sm:pt-20">
    <Section
        spacing="none"
        class="relative z-10 pt-5 pb-6 md:pt-8 md:pb-8">
        <PageContainer
            width="standard"
            class="flex flex-col gap-8">
            <div
                class="pointer-events-none absolute top-16.5 left-[50%] z-0 h-80 w-[320px] translate-x-[-50%] rounded-full bg-accent/10 blur-[80px]">
            </div>

            <div class="relative z-10 flex flex-col items-start text-left select-none">
                <Badge
                    variant="accent"
                    size="sm"
                    class="mb-3">
                    <MessageSquareWarning class="size-3" />
                    Feedback & Reports
                </Badge>
                <h1 class="type-page-title md:text-4xl">Your feedback matters</h1>
                <p class="mt-4 max-w-2xl text-base leading-relaxed text-text-secondary">
                    Your valuable feedback helps improve the quality of articles and ensures the
                    website's technical systems run reliably. Please let me know if you spot any
                    issues.
                </p>
            </div>

            <Card
                variant="glass"
                class="relative z-10 p-5 select-none">
                <div class="flex flex-col gap-3.5">
                    <div class="flex flex-col">
                        <h2 class="type-card-title">Feedback categories</h2>
                        <p class="mt-0.5 text-xs text-text-muted">
                            Click any category to quickly populate your message below.
                        </p>
                    </div>

                    <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        <button
                            type="button"
                            onclick={() => selectCategory('Writing error')}
                            use:shortcut={{ combo: '1', label: 'Writing errors' }}
                            class="group relative flex cursor-pointer flex-col gap-1.5 rounded-md border border-border-subtle/70 bg-surface-card/40 p-3.5 text-left transition-all hover:border-accent/40 hover:bg-surface-card/80 focus-visible:border-accent focus-visible:outline-none"
                            aria-label="Select category: Writing errors">
                            <div class="flex items-center gap-2">
                                <PenLine
                                    class="size-4 shrink-0 text-accent-text transition-transform group-hover:scale-105" />
                                <span
                                    class="translate-y-[0.5px] text-sm leading-none font-semibold text-text-primary transition-colors group-hover:text-accent-text">
                                    Writing errors
                                </span>
                            </div>
                            <p class="type-body text-text-secondary">
                                Grammatical mistakes, typos, spelling, or poor phrasing.
                            </p>
                        </button>

                        <button
                            type="button"
                            onclick={() => selectCategory('Technical inaccuracy')}
                            use:shortcut={{ combo: '2', label: 'Technical inaccuracies' }}
                            class="group relative flex cursor-pointer flex-col gap-1.5 rounded-md border border-border-subtle/70 bg-surface-card/40 p-3.5 text-left transition-all hover:border-accent/40 hover:bg-surface-card/80 focus-visible:border-accent focus-visible:outline-none"
                            aria-label="Select category: Technical inaccuracies">
                            <div class="flex items-center gap-2">
                                <Code2
                                    class="size-4 shrink-0 text-accent-text transition-transform group-hover:scale-105" />
                                <span
                                    class="translate-y-[0.5px] text-sm leading-none font-semibold text-text-primary transition-colors group-hover:text-accent-text">
                                    Technical inaccuracies
                                </span>
                            </div>
                            <p class="type-body text-text-secondary">
                                Code snippets that don't compile, wrong command usages, or faulty
                                explanation logic.
                            </p>
                        </button>

                        <button
                            type="button"
                            onclick={() => selectCategory('Outdated information')}
                            use:shortcut={{ combo: '3', label: 'Outdated information' }}
                            class="group relative flex cursor-pointer flex-col gap-1.5 rounded-md border border-border-subtle/70 bg-surface-card/40 p-3.5 text-left transition-all hover:border-accent/40 hover:bg-surface-card/80 focus-visible:border-accent focus-visible:outline-none"
                            aria-label="Select category: Outdated information">
                            <div class="flex items-center gap-2">
                                <ClockFading
                                    class="size-4 shrink-0 text-accent-text transition-transform group-hover:scale-105" />
                                <span
                                    class="translate-y-[0.5px] text-sm leading-none font-semibold text-text-primary transition-colors group-hover:text-accent-text">
                                    Outdated information
                                </span>
                            </div>
                            <p class="type-body text-text-secondary">
                                Deprecated package API calls, tools that are no longer active, or
                                outdated tutorial steps.
                            </p>
                        </button>

                        <button
                            type="button"
                            onclick={() => selectCategory('Broken link')}
                            use:shortcut={{ combo: '4', label: 'Broken links' }}
                            class="group relative flex cursor-pointer flex-col gap-1.5 rounded-md border border-border-subtle/70 bg-surface-card/40 p-3.5 text-left transition-all hover:border-accent/40 hover:bg-surface-card/80 focus-visible:border-accent focus-visible:outline-none"
                            aria-label="Select category: Broken links">
                            <div class="flex items-center gap-2">
                                <Link2Off
                                    class="size-4 shrink-0 text-accent-text transition-transform group-hover:scale-105" />
                                <span
                                    class="translate-y-[0.5px] text-sm leading-none font-semibold text-text-primary transition-colors group-hover:text-accent-text">
                                    Broken links
                                </span>
                            </div>
                            <p class="type-body text-text-secondary">
                                404 links, invalid references, or missing static download files.
                            </p>
                        </button>

                        <button
                            type="button"
                            onclick={() => selectCategory('Website issue')}
                            use:shortcut={{ combo: '5', label: 'Website issues' }}
                            class="group relative flex cursor-pointer flex-col gap-1.5 rounded-md border border-border-subtle/70 bg-surface-card/40 p-3.5 text-left transition-all hover:border-accent/40 hover:bg-surface-card/80 focus-visible:border-accent focus-visible:outline-none"
                            aria-label="Select category: Website issues">
                            <div class="flex items-center gap-2">
                                <Bug
                                    class="size-4 shrink-0 text-accent-text transition-transform group-hover:scale-105" />
                                <span
                                    class="translate-y-[0.5px] text-sm leading-none font-semibold text-text-primary transition-colors group-hover:text-accent-text">
                                    Website issues
                                </span>
                            </div>
                            <p class="type-body text-text-secondary">
                                UI layout bugs, visual display mistakes, broken styling, or slow
                                loading times.
                            </p>
                        </button>

                        <button
                            type="button"
                            onclick={() => selectCategory('Other issue')}
                            use:shortcut={{ combo: '6', label: 'Other issues' }}
                            class="group relative flex cursor-pointer flex-col gap-1.5 rounded-md border border-border-subtle/70 bg-surface-card/40 p-3.5 text-left transition-all hover:border-accent/40 hover:bg-surface-card/80 focus-visible:border-accent focus-visible:outline-none"
                            aria-label="Select category: Other issues">
                            <div class="flex items-center gap-2">
                                <HelpCircle
                                    class="size-4 shrink-0 text-accent-text transition-transform group-hover:scale-105" />
                                <span
                                    class="translate-y-[0.5px] text-sm leading-none font-semibold text-text-primary transition-colors group-hover:text-accent-text">
                                    Other issues
                                </span>
                            </div>
                            <p class="type-body text-text-secondary">
                                General inquiries, suggestions, content ideas, or feedback outside
                                listed categories.
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
                    <h2 class="type-card-title">Report an issue</h2>
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
                                queueMicrotask(() => validation.input('name'));
                            }}
                            onblur={() => {
                                void validation.check('name');
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
                                queueMicrotask(() => validation.input('email'));
                            }}
                            onblur={() => {
                                void validation.check('email');
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
                            queueMicrotask(() => validation.input('url'));
                        }}
                        onblur={() => {
                            void validation.check('url');
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
                            queueMicrotask(() => validation.input('message'));
                        }}
                        onblur={() => {
                            void validation.check('message');
                        }} />
                </FormField>

                {#if turnstileSiteKey}
                    <div
                        bind:this={turnstileFeedbackEl}
                        class="turnstile-widget select-none"
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
                        keyboardShortcut={buttonKey('formClear')}
                        shortcutLabel="Clear feedback"
                        onclick={clearFeedbackForm}>
                        <span>Clear<span class="hidden sm:inline">&nbsp;feedback</span></span>
                    </Button>
                    <Button
                        htmlType="submit"
                        type="primary"
                        size="md"
                        class="flex-1 sm:flex-initial"
                        aria-keyshortcuts="Control+Enter Meta+Enter"
                        disabled={isSubmitting}
                        isLoading={isSubmitting}
                        keyboardShortcut={buttonKey('formSubmit')}
                        shortcutLabel="Submit feedback">
                        {isSubmitting ? 'Submitting…' : 'Submit feedback'}
                    </Button>
                </div>
            </form>
        </PageContainer>
    </Section>

    <FooterSection />
</main>
