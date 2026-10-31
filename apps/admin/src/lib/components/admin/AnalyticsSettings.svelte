<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { onMount } from 'svelte';
    import {
        ANALYTICS_DEFAULT_SCRIPTS,
        ANALYTICS_PROVIDERS,
        ANALYTICS_PROVIDER_INFO,
        type AnalyticsProvider,
        type AnalyticsSettings
    } from '@idstead/domain/analytics.ts';
    import Button from '@idstead/ui/components/Button.svelte';
    import Card from '@idstead/ui/components/Card.svelte';
    import Dropdown from '@idstead/ui/components/Dropdown.svelte';
    import ErrorState from '@idstead/ui/components/ErrorState.svelte';
    import FieldMessage from '@idstead/ui/components/FieldMessage.svelte';
    import FormField from '@idstead/ui/components/FormField.svelte';
    import Input from '@idstead/ui/components/Input.svelte';
    import LoadingState from '@idstead/ui/components/LoadingState.svelte';
    import StatusBanner from '@idstead/ui/components/StatusBanner.svelte';
    import FormSection from '@idstead/ui/layout/FormSection.svelte';
    import { toastStore } from '@idstead/ui/stores/toastStore.svelte.ts';
    import { adminFetch, adminRequest } from '#app/adminClient.ts';

    type Field = 'measurementId' | 'containerId' | 'websiteId' | 'scriptUrl' | 'token';

    const FIELDS: Record<
        AnalyticsProvider,
        { key: Field; label: string; placeholder: string; hint?: string }[]
    > = {
        none: [],
        ga4: [{ key: 'measurementId', label: 'Measurement ID', placeholder: 'G-ABC123XYZ' }],
        gtm: [{ key: 'containerId', label: 'Container ID', placeholder: 'GTM-ABC1234' }],
        umami: [
            {
                key: 'websiteId',
                label: 'Website ID',
                placeholder: '00000000-0000-0000-0000-000000000000'
            },
            {
                key: 'scriptUrl',
                label: 'Script URL',
                placeholder: ANALYTICS_DEFAULT_SCRIPTS.umami,
                hint: 'Leave empty for Umami Cloud.'
            }
        ],
        plausible: [
            {
                key: 'scriptUrl',
                label: 'Script URL',
                placeholder: ANALYTICS_DEFAULT_SCRIPTS.plausible,
                hint: 'Leave empty for Plausible Cloud.'
            }
        ],
        cloudflare: [{ key: 'token', label: 'Beacon token', placeholder: '32-character token' }]
    };

    const providerOptions = ANALYTICS_PROVIDERS.map(value => ({
        value,
        label: value === 'none' ? 'No analytics' : ANALYTICS_PROVIDER_INFO[value].name
    }));

    let loading = $state(true);
    let loadError = $state('');
    let saving = $state(false);
    let provider = $state<AnalyticsProvider>('none');
    let values = $state<Record<Field, string>>({
        measurementId: '',
        containerId: '',
        websiteId: '',
        scriptUrl: '',
        token: ''
    });
    let fieldError = $state<{ field: string; message: string } | null>(null);

    const fields = $derived(FIELDS[provider]);
    const cookies = $derived(ANALYTICS_PROVIDER_INFO[provider].cookies);

    function apply(settings: AnalyticsSettings) {
        provider = settings.provider;
        for (const key of Object.keys(values) as Field[])
            values[key] = String((settings as Record<string, unknown>)[key] ?? '');
    }

    async function load() {
        loading = true;
        loadError = '';
        try {
            apply(
                (await adminRequest<{ analytics: AnalyticsSettings }>('site-settings/analytics'))
                    .analytics
            );
        } catch (error) {
            loadError = error instanceof Error ? error.message : 'Could not load the settings.';
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        void load();
    });

    function setProvider(value: AnalyticsProvider) {
        provider = value;
        fieldError = null;
    }

    async function save(event: SubmitEvent) {
        event.preventDefault();
        if (saving) return;
        saving = true;
        fieldError = null;
        const body: Record<string, string> = { provider };
        for (const { key } of fields) body[key] = values[key].trim();
        try {
            const response = await adminFetch('/api/internal/admin/site-settings/analytics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const result = await response.json().catch(() => null);
            if (response.ok && result?.analytics) {
                apply(result.analytics);
                toastStore.success('Analytics settings saved.');
                return;
            }
            fieldError = {
                field: result?.error?.details ?? 'provider',
                message: result?.error?.message ?? 'The settings could not be saved.'
            };
        } catch (error) {
            fieldError = {
                field: 'provider',
                message: error instanceof Error ? error.message : 'The settings could not be saved.'
            };
        } finally {
            saving = false;
        }
    }
</script>

<FormSection
    title="Analytics & cookies"
    titleClass="type-card-title"
    description="Choose the analytics the public site loads. Only the chosen provider's script and hosts are allowed, and the cookie banner appears only for providers that set cookies."
    onsubmit={save}
    bare>
    {#if loading}
        <LoadingState
            variant="spinner"
            label="Loading analytics settings..." />
    {:else if loadError}
        <ErrorState
            title="Couldn't load the analytics settings"
            description={loadError}
            onRetry={load} />
    {:else}
        <div class="flex max-w-lg flex-col gap-4">
            <Dropdown
                id="analytics-provider"
                label="Provider"
                value={provider}
                options={providerOptions}
                fullWidth
                onChange={setProvider} />
            {#if fieldError?.field === 'provider'}<FieldMessage message={fieldError.message} />{/if}
            {#each fields as field (field.key)}
                <FormField
                    id={`analytics-${field.key}`}
                    label={field.label}
                    hint={field.hint}
                    error={fieldError?.field === field.key ? fieldError.message : ''}>
                    <Input
                        id={`analytics-${field.key}`}
                        autocapitalize="none"
                        spellcheck={false}
                        placeholder={field.placeholder}
                        bind:value={values[field.key]}
                        disabled={saving}
                        error={fieldError?.field === field.key} />
                </FormField>
            {/each}
            <Card
                variant="bordered"
                density="compact"
                class="border-line-subtle! bg-surface!">
                <p class="type-body text-fg-secondary">
                    {#if provider === 'none'}
                        The site loads no analytics script and shows no cookie banner or Cookies
                        link.
                    {:else if cookies}
                        {ANALYTICS_PROVIDER_INFO[provider].name} sets cookies, so visitors see the cookie
                        banner and nothing is measured until they agree.
                    {:else}
                        {ANALYTICS_PROVIDER_INFO[provider].name} sets no cookies, so the site shows no
                        cookie banner.
                    {/if}
                </p>
            </Card>
            <StatusBanner
                variant="info"
                title="Keep the privacy policy in sync"
                message="Legal pages can read api.v1.analytics (enabled, provider, name, cookies) in :::if blocks, so their text follows this setting." />
        </div>
    {/if}
    {#snippet actions()}
        <Button
            htmlType="submit"
            size="md"
            isLoading={saving}
            disabled={saving || loading || !!loadError}>Save</Button>
    {/snippet}
</FormSection>
