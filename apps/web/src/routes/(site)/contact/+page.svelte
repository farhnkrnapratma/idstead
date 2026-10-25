<script lang="ts">
    import { onDestroy } from 'svelte';
    import { AtSign } from '@lucide/svelte';
    import {
        Button,
        FormField,
        Input,
        PageContainer,
        PageMain,
        Section,
        Textarea,
        toastStore
    } from '@idstead/ui';
    import { buttonKey } from '@idstead/ui/shortcuts.ts';
    import { FieldValidation, requiredText, emailError } from '@idstead/domain/fieldValidation.ts';
    import { isNameReserved, extractAuthorNameTokens } from '@idstead/domain/nameValidator.ts';
    import {
        turnstileWidget,
        executeTurnstile,
        resetTurnstile,
        turnstileSiteKey
    } from '#lib/utils/turnstile.ts';
    import FooterSection from '#app/layout/FooterSection.svelte';
    import LinkGridSection from '#app/components/LinkGridSection.svelte';
    import ConsentNotice from '#app/components/ConsentNotice.svelte';
    import SiteMeta from '#app/components/SiteMeta.svelte';

    let { data } = $props();

    const author = $derived(data.author);
    const authorTokens = $derived(extractAuthorNameTokens(author));

    let contactItems = $derived(
        (data.contact || []).map(c => ({
            label: c.platform || c.displayValue,
            value: c.displayValue,
            href: c.href,
            icon: c.icon || '',
            description: c.description || ''
        }))
    );

    let formName = $state('');
    let formEmail = $state('');
    let formMessage = $state('');
    let formErrors = $state({ name: '', email: '', message: '' });
    let formValid = $state({ name: false, email: false, message: false });
    let isSubmittingMessage = $state(false);
    let turnstileContactEl = $state<HTMLDivElement | null>(null);

    const canClearContactForm = $derived(
        Boolean(formName.trim() || formEmail.trim() || formMessage.trim())
    );

    function clearContactForm() {
        formName = '';
        formEmail = '';
        formMessage = '';
        formErrors = { name: '', email: '', message: '' };
        formValid = { name: false, email: false, message: false };
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

    async function validateForm(e: SubmitEvent) {
        e.preventDefault();

        if (!(await validation.submit(undefined, true))) return;

        if (!data.canSendMessage) {
            toastStore.error('Message submission is currently unavailable.');
            return;
        }

        isSubmittingMessage = true;

        try {
            let turnstileToken = '';
            if (turnstileSiteKey) {
                const token = await executeTurnstile(turnstileContactEl);
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
                    kind: 'message',
                    name: formName.trim(),
                    email: formEmail.trim(),
                    message: formMessage.trim(),
                    turnstileToken
                })
            });

            const data = await res.json().catch(() => null);
            if (!res.ok || data?.success !== true) {
                throw new Error(
                    typeof data?.error?.message === 'string' ?
                        data.error.message
                    :   'Failed to send message.'
                );
            }

            toastStore.success('Message sent successfully. Thank you!');
            formName = '';
            formEmail = '';
            formMessage = '';
            formErrors = { name: '', email: '', message: '' };
            formValid = { name: false, email: false, message: false };
            validation.reset();
        } catch (err) {
            const msg =
                err instanceof Error && err.message ?
                    err.message
                :   'Failed to send message. Please try again later.';
            toastStore.error(msg);
        } finally {
            isSubmittingMessage = false;
            resetTurnstile(turnstileContactEl);
        }
    }
</script>

<SiteMeta
    title="Contact"
    description={data.author?.name ?
        `Get in touch with ${data.author.name}.`
    :   'Contact channels and a message form.'}
    path="/contact"
    siteName={data.author?.name || ''}
    siteUrl={data.author?.siteUrl || ''} />

<svelte:head>
    <script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        async
        defer></script>
</svelte:head>

<PageMain variant="site">
    <LinkGridSection
        title="Contact"
        items={contactItems}
        showEmpty={!data.canSendMessage}
        shortcutGroup="contact"
        emptyIcon={AtSign}
        emptyTitle="No contact channels yet"
        emptyDescription="Check back soon for ways to get in touch." />

    {#if data.canSendMessage}
        <Section
            spacing="none"
            class="relative z-10 pb-6 md:pb-8">
            <PageContainer width="standard">
                <form
                    novalidate
                    onsubmit={validateForm}
                    class="flex w-full flex-col gap-2.5 rounded-md glass-card p-4 text-left sm:gap-3 sm:p-6"
                    autocomplete="off">
                    <div class="mb-2 select-none">
                        <h2 class="type-card-title">Send a Message</h2>
                        <p class="mt-0.5 type-body text-fg-muted">
                            Feel free to drop me a line. I'll get back to you as soon as possible.
                        </p>
                    </div>

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

                    <div
                        {@attach element => {
                            turnstileContactEl = element;
                            return () => {
                                turnstileContactEl = null;
                            };
                        }}
                        class="turnstile-widget select-none"
                        use:turnstileWidget={{
                            sitekey: turnstileSiteKey,
                            size: 'flexible',
                            action: 'contact-message',
                            theme: 'auto',
                            appearance: 'interaction-only',
                            execution: 'execute'
                        }}>
                    </div>

                    <ConsentNotice action="sending this message" />

                    <div class="mt-2 flex items-center justify-between gap-2 select-none">
                        <Button
                            htmlType="button"
                            type="outline"
                            tone="critical"
                            size="md"
                            class="flex-1 sm:flex-initial"
                            disabled={!canClearContactForm || isSubmittingMessage}
                            keyboardShortcut={buttonKey('formClear')}
                            shortcutLabel="Clear message"
                            onclick={clearContactForm}>
                            <span>Clear<span class="hidden sm:inline">&nbsp;message</span></span>
                        </Button>
                        <Button
                            htmlType="submit"
                            type="primary"
                            size="md"
                            class="flex-1 sm:flex-initial"
                            aria-keyshortcuts="Control+Enter Meta+Enter"
                            disabled={isSubmittingMessage}
                            isLoading={isSubmittingMessage}
                            keyboardShortcut={buttonKey('formSubmit')}
                            shortcutLabel="Send message">
                            {isSubmittingMessage ? 'Sending…' : 'Send message'}
                        </Button>
                    </div>
                </form>
            </PageContainer>
        </Section>
    {/if}

    <FooterSection />
</PageMain>
