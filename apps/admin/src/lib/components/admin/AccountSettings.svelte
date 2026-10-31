<script lang="ts">
    import { type Snippet } from 'svelte';
    import { page } from '$app/state';
    import { adminUrl, navigateAdmin } from '../../adminNavigation.ts';
    import { resolveAdminSettings, type AdminSettingsSection } from '../../adminUrl.ts';
    import { ACCESS_LOGOUT_URL } from '../../adminClient.ts';
    import {
        ArrowUpRight,
        ChartColumn,
        Copyright,
        Database,
        Eye,
        LogOut,
        ShieldCheck
    } from '@lucide/svelte';
    import { Button, Card } from '@idstead/ui';
    import FormSection from '@idstead/ui/layout/FormSection.svelte';
    import Section from '@idstead/ui/layout/Section.svelte';
    import ActivityTimestamp from './ActivityTimestamp.svelte';
    import AnalyticsSettings from './AnalyticsSettings.svelte';
    import ContentLicenseSettings from './ContentLicenseSettings.svelte';
    import DisplaySettings from './DisplaySettings.svelte';

    const ZERO_TRUST_DASHBOARD = 'https://dash.cloudflare.com/one';

    let { children }: { children?: Snippet } = $props();

    const admin = $derived(page.data.admin as { email: string; signedInAt: string } | null);
    const accessTeamDomain = $derived(page.data.accessTeamDomain as string | null);
    const activeTab = $derived(resolveAdminSettings(adminUrl().searchParams.get('settings')));

    const tabs = [
        { id: 'appearance' as const, label: 'Appearance', icon: Eye },
        { id: 'security' as const, label: 'Account & Security', icon: ShieldCheck },
        { id: 'analytics' as const, label: 'Analytics & cookies', icon: ChartColumn },
        { id: 'content' as const, label: 'Content license', icon: Copyright },
        { id: 'data' as const, label: 'Data Management', icon: Database }
    ];

    function selectSection(event: MouseEvent, section: AdminSettingsSection) {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;
        event.preventDefault();
        if (activeTab === section) return;
        const url = adminUrl();
        url.searchParams.set('settings', section);
        navigateAdmin(url);
    }
</script>

<Section
    spacing="none"
    class="flex min-w-0 flex-col gap-4">
    <div>
        <h1 class="type-page-title">Settings</h1>
        <p class="mt-1 type-body text-fg-secondary">
            Manage appearance, account security, analytics, content license, and site data.
        </p>
    </div>

    <nav
        aria-label="Settings sections"
        data-sveltekit-preload-data="off"
        class="flex flex-wrap gap-1 border-b border-line-subtle">
        {#each tabs as tab (tab.id)}
            <a
                href={`/?tab=account&settings=${tab.id}`}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                class={[
                    'flex min-h-11 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring',
                    activeTab === tab.id ?
                        'border-accent text-fg-accent'
                    :   'border-transparent text-fg-secondary hover:text-fg'
                ]}
                onclick={event => selectSection(event, tab.id)}>
                <tab.icon class="size-4" />
                {tab.label}
            </a>
        {/each}
    </nav>

    {#if activeTab === 'appearance'}
        <DisplaySettings />
    {/if}
    {#if activeTab === 'security'}
        <Card
            variant="bordered"
            class="border-line-subtle! bg-surface!">
            <FormSection
                title="Sign-in"
                titleClass="type-card-title"
                description="Cloudflare Access protects this admin. Sign-in methods, two-factor authentication and sessions are managed in the Cloudflare Zero Trust dashboard."
                bare>
                <div
                    class="flex flex-col gap-3 rounded-md border border-line-subtle bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <span class="min-w-0 text-xs text-fg-secondary">
                        Signed in as <span class="font-semibold break-all text-fg"
                            >{admin?.email ?? 'unknown'}</span
                        >{#if admin?.signedInAt}, <ActivityTimestamp
                                date={admin.signedInAt}
                                class="font-semibold" />{/if}.
                    </span>
                    <span class="flex shrink-0 flex-wrap gap-2">
                        {#if accessTeamDomain}
                            <Button
                                type="secondary"
                                size="sm"
                                href={`https://${accessTeamDomain}/AddMfaDevice`}
                                target="_blank"
                                rel="noopener noreferrer">
                                {#snippet leading()}<ShieldCheck class="size-3.5" />{/snippet}
                                Enroll MFA
                            </Button>
                        {/if}
                        <Button
                            type="secondary"
                            size="sm"
                            href={ZERO_TRUST_DASHBOARD}
                            target="_blank"
                            rel="noopener noreferrer">
                            {#snippet leading()}<ArrowUpRight
                                    class="size-3.5"
                                    strokeWidth={1.5} />{/snippet}
                            Manage sign-in
                        </Button>
                        <Button
                            type="danger"
                            tone="critical"
                            size="sm"
                            href={ACCESS_LOGOUT_URL}>
                            {#snippet leading()}<LogOut class="size-3.5" />{/snippet}
                            Sign out
                        </Button>
                    </span>
                </div>
            </FormSection>
        </Card>
    {/if}
    {#if activeTab === 'analytics'}
        <Card
            variant="bordered"
            class="border-line-subtle! bg-surface!">
            <AnalyticsSettings />
        </Card>
    {/if}
    {#if activeTab === 'content'}
        <Card
            variant="bordered"
            class="border-line-subtle! bg-surface!">
            <ContentLicenseSettings />
        </Card>
    {/if}
    {#if activeTab === 'data'}
        {@render children?.()}
    {/if}
</Section>
