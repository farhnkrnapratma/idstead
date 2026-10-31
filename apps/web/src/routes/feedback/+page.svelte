<script lang="ts">
    import AuthorOgImage from '#app/components/AuthorOgImage.svelte';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import { FieldValidation, requiredText, emailError } from '@idstead/domain/fieldValidation.ts';
    import { page } from '$app/state';
    import { shortcut } from '@idstead/ui/utils/shortcut.svelte.ts';
    import { buttonKey } from '@idstead/ui/shortcuts.ts';
    import { onDestroy } from 'svelte';
    import {
        PenLine,
        CodeXml,
        ClockFading,
        Link2Off,
        Bug,
        CircleQuestionMark,
        MessageSquareWarning
    } from '@lucide/svelte';
    import { isNameReserved, extractAuthorNameTokens } from '@idstead/domain/nameValidator.ts';
    import {
        Card,
        FormField,
        Input,
        Textarea,
        Button,
        PageMain,
        PageContainer,
        toastStore
    } from '@idstead/ui';
    import FooterSection from '#app/layout/FooterSection.svelte';
    import ConsentNotice from '#app/components/ConsentNotice.svelte';
    import { EmptyState, Section } from '@idstead/ui';
    import {
        turnstileWidget,
        executeTurnstile,
        resetTurnstile,
        turnstileSiteKey
    } from '#lib/utils/turnstile.ts';

    let pageAuthor = $derived((page?.data as any)?.author);
    let authorName = $derived(pageAuthor?.name || '');
    let authorTokens = $derived(extractAuthorNameTokens(pageAuthor));
    let siteUrl = $derived(((page?.data as any)?.author?.siteUrl || '').replace(/\/$/, ''));
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
    const FEEDBACK_CATEGORIES = [
        {
            value: 'Writing error',
            label: 'Writing errors',
            icon: PenLine,
            description: 'Grammatical mistakes, typos, spelling, or poor phrasing.'
        },
        {
            value: 'Technical inaccuracy',
            label: 'Technical inaccuracies',
            icon: CodeXml,
            description:
                "Code snippets that don't compile, wrong command usages, or faulty explanation logic."
        },
        {
            value: 'Outdated information',
            label: 'Outdated information',
            icon: ClockFading,
            description:
                'Deprecated package API calls, tools that are no longer active, or outdated tutorial steps.'
        },
        {
            value: 'Broken link',
            label: 'Broken links',
            icon: Link2Off,
            description: '404 links, invalid references, or missing static download files.'
        },
        {
            value: 'Website issue',
            label: 'Website issues',
            icon: Bug,
            description:
                'UI layout bugs, visual display mistakes, broken styling, or slow loading times.'
        },
        {
            value: 'Other issue',
            label: 'Other issues',
            icon: CircleQuestionMark,
            description:
                'General inquiries, suggestions, content ideas, or feedback outside listed categories.'
        }
    ];

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
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
</svelte:head>
<AuthorOgImage author={pageAuthor} />

<PageMain variant="site">
    <Section
        spacing="none"
        class={cn(
            'relative z-10 pt-5 pb-6 md:pt-8 md:pb-8',
            !contactEmail && 'flex flex-1 flex-col justify-center'
        )}>
        <PageContainer
            width="standard"
            class="flex flex-col gap-8">
            {#if !contactEmail}
                <EmptyState
                    icon={MessageSquareWarning}
                    title="Feedback is not available yet"
                    description="This site cannot receive feedback until its owner adds a contact email." />
            {:else}
                <div class="relative z-10 flex flex-col items-start text-left select-none">
                    <h1 class="type-page-title md:text-4xl">Your feedback matters</h1>
                    <p class="mt-4 max-w-2xl text-base leading-relaxed text-fg-secondary">
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
                            <p class="mt-0.5 text-xs text-fg-muted">
                                Click any category to quickly populate your message below.
                            </p>
                        </div>

                        <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            {#each FEEDBACK_CATEGORIES as category, index (category.value)}
                                <button
                                    type="button"
                                    onclick={() => selectCategory(category.value)}
                                    use:shortcut={{
                                        combo: String(index + 1),
                                        label: category.label
                                    }}
                                    class="group relative flex cursor-pointer flex-col gap-1.5 rounded-md border border-line-subtle/70 bg-surface/40 p-3.5 text-left transition-all hover:border-accent/40 hover:bg-surface/80 focus-visible:border-accent focus-visible:outline-none"
                                    aria-label="Select category: {category.label}">
                                    <div class="flex items-center gap-2">
                                        <category.icon
                                            class="size-4 shrink-0 text-fg-accent transition-transform group-hover:scale-105" />
                                        <span
                                            class="translate-y-[0.5px] text-sm leading-none font-semibold text-fg transition-colors group-hover:text-fg-accent">
                                            {category.label}
                                        </span>
                                    </div>
                                    <p class="type-body text-fg-secondary">
                                        {category.description}
                                    </p>
                                </button>
                            {/each}
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
                        <p class="mt-0.5 text-xs text-fg-muted">
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
                            {@attach node => {
                                turnstileFeedbackEl = node;
                                return () => {
                                    turnstileFeedbackEl = null;
                                };
                            }}
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
            {/if}
        </PageContainer>
    </Section>

    <FooterSection />
</PageMain>
