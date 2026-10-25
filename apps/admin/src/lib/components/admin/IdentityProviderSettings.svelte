<script lang="ts">
    import { onMount } from 'svelte';
    import { AppWindow, Copy, KeyRound, Pencil, Plus, ShieldOff, Trash } from '@lucide/svelte';
    import Button from '@idstead/ui/components/Button.svelte';
    import Card from '@idstead/ui/components/Card.svelte';
    import Checkbox from '@idstead/ui/components/Checkbox.svelte';
    import ConfirmationDialog from '@idstead/ui/components/ConfirmationDialog.svelte';
    import DataTable from '@idstead/ui/components/DataTable.svelte';
    import Dialog from '@idstead/ui/components/Dialog.svelte';
    import EmptyState from '@idstead/ui/components/EmptyState.svelte';
    import ErrorState from '@idstead/ui/components/ErrorState.svelte';
    import FormField from '@idstead/ui/components/FormField.svelte';
    import Input from '@idstead/ui/components/Input.svelte';
    import LoadingState from '@idstead/ui/components/LoadingState.svelte';
    import RelativeTime from '@idstead/ui/components/RelativeTime.svelte';
    import StatusBanner from '@idstead/ui/components/StatusBanner.svelte';
    import Tag from '@idstead/ui/components/Tag.svelte';
    import Textarea from '@idstead/ui/components/Textarea.svelte';
    import FormSection from '@idstead/ui/layout/FormSection.svelte';
    import { toastStore } from '@idstead/ui/stores/toastStore.svelte.ts';
    import { copyText } from '@idstead/ui/utils/fileActions.ts';
    import { adminRequest } from '#app/adminClient.ts';

    interface OidcClient {
        clientId: string;
        name: string;
        redirectUris: string[];
        confidential: boolean;
        createdAt: string;
        updatedAt: string;
    }

    interface OidcGrant {
        id: string;
        clientId: string;
        clientName: string;
        scopes: string[];
        createdAt: string;
        lastUsedAt: string | null;
    }

    interface ClientsResponse {
        enabled: boolean;
        issuer: string;
        discoveryUrl: string;
        clients: OidcClient[];
    }

    let data = $state<ClientsResponse | null>(null);
    let loadError = $state('');
    let loading = $state(true);

    let editorOpen = $state(false);
    let editing = $state<OidcClient | null>(null);
    let formName = $state('');
    let formRedirects = $state('');
    let formConfidential = $state(true);
    let formError = $state('');
    let saving = $state(false);

    let secret = $state<{ clientId: string; clientSecret: string } | null>(null);
    let pendingDelete = $state<OidcClient | null>(null);
    let deleting = $state(false);

    let grants = $state<OidcGrant[]>([]);
    let pendingRevoke = $state<OidcGrant | null>(null);
    let revoking = $state(false);

    async function load() {
        loading = true;
        loadError = '';
        try {
            const [clients, access] = await Promise.all([
                adminRequest<ClientsResponse>('oidc/clients'),
                adminRequest<{ grants: OidcGrant[] }>('oidc/grants')
            ]);
            data = clients;
            grants = access.grants;
        } catch (error) {
            loadError = error instanceof Error ? error.message : 'Could not load the apps.';
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        void load();
    });

    function openCreate() {
        editing = null;
        formName = '';
        formRedirects = '';
        formConfidential = true;
        formError = '';
        editorOpen = true;
    }

    function openEdit(client: OidcClient) {
        editing = client;
        formName = client.name;
        formRedirects = client.redirectUris.join('\n');
        formError = '';
        editorOpen = true;
    }

    async function save() {
        saving = true;
        formError = '';
        const redirectUris = formRedirects
            .split('\n')
            .map(uri => uri.trim())
            .filter(Boolean);
        try {
            if (editing) {
                await adminRequest('oidc/clients', {
                    body: {
                        action: 'update',
                        clientId: editing.clientId,
                        name: formName,
                        redirectUris
                    }
                });
                toastStore.success('App updated.');
            } else {
                const result = await adminRequest<{
                    client: OidcClient;
                    clientSecret: string | null;
                }>('oidc/clients', {
                    body: {
                        action: 'create',
                        name: formName,
                        redirectUris,
                        confidential: formConfidential
                    }
                });
                if (result.clientSecret)
                    secret = {
                        clientId: result.client.clientId,
                        clientSecret: result.clientSecret
                    };
                else toastStore.success('App registered.');
            }
            editorOpen = false;
            await load();
        } catch (error) {
            formError = error instanceof Error ? error.message : 'Could not save the app.';
        } finally {
            saving = false;
        }
    }

    async function rotate(client: OidcClient) {
        try {
            const result = await adminRequest<{ clientSecret: string }>('oidc/clients', {
                body: { action: 'rotate', clientId: client.clientId }
            });
            secret = { clientId: client.clientId, clientSecret: result.clientSecret };
        } catch (error) {
            toastStore.error(
                error instanceof Error ? error.message : 'Could not rotate the secret.'
            );
        }
    }

    async function confirmDelete() {
        if (!pendingDelete) return;
        deleting = true;
        try {
            await adminRequest('oidc/clients', {
                body: { action: 'delete', clientId: pendingDelete.clientId }
            });
            toastStore.success('App deleted and its access revoked.');
            pendingDelete = null;
            await load();
        } catch (error) {
            toastStore.error(error instanceof Error ? error.message : 'Could not delete the app.');
        } finally {
            deleting = false;
        }
    }

    async function confirmRevoke() {
        if (!pendingRevoke) return;
        revoking = true;
        try {
            await adminRequest('oidc/grants', { body: { action: 'revoke', id: pendingRevoke.id } });
            toastStore.success(`${pendingRevoke.clientName} no longer has access.`);
            pendingRevoke = null;
            await load();
        } catch (error) {
            toastStore.error(error instanceof Error ? error.message : 'Could not revoke access.');
        } finally {
            revoking = false;
        }
    }

    const grantColumns = [
        { key: 'clientName', header: 'App', width: '24%' },
        { key: 'scopes', header: 'Access', width: '30%' },
        { key: 'createdAt', header: 'Allowed', width: '18%' },
        { key: 'lastUsedAt', header: 'Last used', width: '18%' },
        { key: 'actions', header: '', srHeader: 'Actions', align: 'right' as const, width: '10%' }
    ];

    const columns = [
        { key: 'name', header: 'App', width: '28%' },
        { key: 'clientId', header: 'Client ID', width: '30%' },
        { key: 'redirects', header: 'Redirect URIs', width: '26%' },
        { key: 'actions', header: '', srHeader: 'Actions', align: 'right' as const, width: '16%' }
    ];
</script>

<FormSection
    title="Sign in with Idstead"
    titleClass="type-card-title"
    description="Apps you register here can let you sign in with this site's identity through OpenID Connect."
    bare>
    {#if loading && !data}
        <LoadingState
            variant="spinner"
            label="Loading apps..." />
    {:else if loadError}
        <ErrorState
            title="Couldn't load the apps"
            description={loadError}
            onRetry={load} />
    {:else if data}
        {#if !data.enabled}
            <StatusBanner
                variant="warning"
                title="Sign-in is off"
                message="Set the OIDC_SIGNING_KEY secret on the web Worker and OIDC_ENABLED=1 on the admin Worker to turn sign-in on. Apps can be registered now and start working once both are set." />
        {/if}

        <Card
            variant="bordered"
            density="compact"
            class="flex flex-col gap-2 border-border-subtle! bg-surface-card!">
            <p class="type-body text-text-secondary">
                Issuer <span class="font-mono text-text-primary">{data.issuer}</span>
            </p>
            <div class="flex flex-wrap items-center gap-2">
                <span class="truncate font-mono text-xs text-text-muted">{data.discoveryUrl}</span>
                <Button
                    type="ghost"
                    size="xs"
                    onclick={() => copyText(data!.discoveryUrl, 'Discovery URL')}>
                    {#snippet leading()}<Copy class="size-3.5" />{/snippet}
                    Copy
                </Button>
            </div>
        </Card>

        {#snippet emptyClients()}
            <EmptyState
                icon={AppWindow}
                title="No apps yet"
                description="Register an app to let it offer Sign in with Idstead." />
        {/snippet}

        <DataTable
            title="Registered apps"
            caption="Registered apps"
            state={data.clients.length ? undefined : emptyClients}
            {columns}
            data={data.clients as unknown as Record<string, unknown>[]}>
            {#snippet toolbar()}
                <Button
                    type="secondary"
                    size="sm"
                    onclick={openCreate}>
                    {#snippet leading()}<Plus class="size-3.5" />{/snippet}
                    Register app
                </Button>
            {/snippet}
            {#snippet cell(row, key)}
                {@const client = row as unknown as OidcClient}
                {#if key === 'name'}
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="font-semibold text-text-primary">{client.name}</span>
                        <Tag>{client.confidential ? 'Confidential' : 'Public'}</Tag>
                    </div>
                {:else if key === 'clientId'}
                    <span class="font-mono text-xs break-all">{client.clientId}</span>
                {:else if key === 'redirects'}
                    <ul class="flex flex-col gap-0.5 font-mono text-xs break-all">
                        {#each client.redirectUris as uri (uri)}
                            <li>{uri}</li>
                        {/each}
                    </ul>
                {:else if key === 'actions'}
                    <div class="flex items-center justify-end gap-1">
                        <Button
                            type="ghost"
                            size="xs"
                            aria-label={`Edit ${client.name}`}
                            onclick={() => openEdit(client)}>
                            <Pencil class="size-3.5" />
                        </Button>
                        {#if client.confidential}
                            <Button
                                type="ghost"
                                size="xs"
                                aria-label={`Rotate the secret of ${client.name}`}
                                onclick={() => rotate(client)}>
                                <KeyRound class="size-3.5" />
                            </Button>
                        {/if}
                        <Button
                            type="ghost"
                            size="xs"
                            aria-label={`Delete ${client.name}`}
                            onclick={() => (pendingDelete = client)}>
                            <Trash class="size-3.5" />
                        </Button>
                    </div>
                {/if}
            {/snippet}
        </DataTable>

        {#snippet emptyGrants()}
            <EmptyState
                icon={ShieldOff}
                title="No app has access"
                description="Apps you allow to sign you in appear here." />
        {/snippet}

        <DataTable
            title="Apps with access"
            caption="Apps with access"
            state={grants.length ? undefined : emptyGrants}
            columns={grantColumns}
            data={grants as unknown as Record<string, unknown>[]}>
            {#snippet cell(row, key)}
                {@const grant = row as unknown as OidcGrant}
                {#if key === 'clientName'}
                    <span class="font-semibold text-text-primary">{grant.clientName}</span>
                {:else if key === 'scopes'}
                    <div class="flex flex-wrap gap-1">
                        {#each grant.scopes as scope (scope)}
                            <Tag>{scope}</Tag>
                        {/each}
                    </div>
                {:else if key === 'createdAt'}
                    <RelativeTime date={grant.createdAt} />
                {:else if key === 'lastUsedAt'}
                    {#if grant.lastUsedAt}
                        <RelativeTime date={grant.lastUsedAt} />
                    {:else}
                        <span class="text-text-muted">Never</span>
                    {/if}
                {:else if key === 'actions'}
                    <div class="flex justify-end">
                        <Button
                            type="ghost"
                            size="xs"
                            aria-label={`Revoke access for ${grant.clientName}`}
                            onclick={() => (pendingRevoke = grant)}>
                            Revoke
                        </Button>
                    </div>
                {/if}
            {/snippet}
        </DataTable>
    {/if}
</FormSection>

<Dialog
    bind:isOpen={editorOpen}
    title={editing ? 'Edit app' : 'Register app'}
    description="Redirect URIs must match exactly: https, or http on localhost for development."
    size="md"
    onClose={() => (editorOpen = false)}>
    <form
        class="flex flex-col gap-4"
        onsubmit={event => {
            event.preventDefault();
            void save();
        }}>
        <FormField
            id="oidc-client-name"
            label="App name"
            required>
            <Input
                id="oidc-client-name"
                bind:value={formName}
                maxlength={80}
                autocomplete="off"
                disabled={saving} />
        </FormField>
        <FormField
            id="oidc-client-redirects"
            label="Redirect URIs"
            description="One per line, up to 10."
            required
            error={formError}>
            <Textarea
                id="oidc-client-redirects"
                bind:value={formRedirects}
                rows={4}
                class="font-mono text-xs"
                spellcheck={false}
                disabled={saving} />
        </FormField>
        {#if !editing}
            <Checkbox
                bind:checked={formConfidential}
                label="Confidential app"
                description="Server-side apps get a client secret. Leave off for apps that run in a browser or on a phone; they sign in with PKCE only." />
        {/if}
        <div class="flex justify-end gap-2">
            <Button
                type="ghost"
                size="sm"
                onclick={() => (editorOpen = false)}
                disabled={saving}>
                Cancel
            </Button>
            <Button
                type="primary"
                size="sm"
                htmlType="submit"
                isLoading={saving}>
                {editing ? 'Save' : 'Register'}
            </Button>
        </div>
    </form>
</Dialog>

<Dialog
    isOpen={secret !== null}
    title="Copy the client secret"
    description="This is the only time the secret is shown. Store it in the app's configuration now."
    size="md"
    onClose={() => (secret = null)}>
    {#if secret}
        <div class="flex flex-col gap-3">
            <FormField
                id="oidc-client-id"
                label="Client ID">
                <Input
                    id="oidc-client-id"
                    value={secret.clientId}
                    readonly
                    class="font-mono" />
            </FormField>
            <FormField
                id="oidc-client-secret"
                label="Client secret">
                <Input
                    id="oidc-client-secret"
                    value={secret.clientSecret}
                    readonly
                    class="font-mono" />
            </FormField>
            <div class="flex justify-end gap-2">
                <Button
                    type="secondary"
                    size="sm"
                    onclick={() => secret && copyText(secret.clientSecret, 'Client secret')}>
                    {#snippet leading()}<Copy class="size-3.5" />{/snippet}
                    Copy secret
                </Button>
                <Button
                    type="primary"
                    size="sm"
                    onclick={() => (secret = null)}>
                    Done
                </Button>
            </div>
        </div>
    {/if}
</Dialog>

<ConfirmationDialog
    isOpen={pendingDelete !== null}
    title="Delete app"
    message={pendingDelete ?
        `${pendingDelete.name} will no longer be able to sign you in, and every token it holds stops working.`
    :   ''}
    confirmLabel="Delete app"
    isDestructive
    isLoading={deleting}
    onConfirm={confirmDelete}
    onCancel={() => (pendingDelete = null)} />

<ConfirmationDialog
    isOpen={pendingRevoke !== null}
    title="Revoke access"
    message={pendingRevoke ?
        `${pendingRevoke.clientName} will have to ask again before it can sign you in, and its tokens stop working.`
    :   ''}
    confirmLabel="Revoke access"
    isDestructive
    isLoading={revoking}
    onConfirm={confirmRevoke}
    onCancel={() => (pendingRevoke = null)} />
