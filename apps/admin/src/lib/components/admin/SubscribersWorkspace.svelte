<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { stableHeight } from '@idstead/ui/utils/stableHeight.ts';
    import { onMount } from 'svelte';
    import { Mail, MailCheck, MailX, Plus, Search, Send, Trash } from '@lucide/svelte';
    import type { AdminSubscriber, SubscriberStatus } from '@idstead/data';
    import { toastStore } from '@idstead/ui';
    import Section from '@idstead/ui/layout/Section.svelte';
    import DataTable from '@idstead/ui/components/DataTable.svelte';
    import Pagination from '@idstead/ui/components/Pagination.svelte';
    import Button from '@idstead/ui/components/Button.svelte';
    import Badge from '@idstead/ui/components/Badge.svelte';
    import Input from '@idstead/ui/components/Input.svelte';
    import Dropdown from '@idstead/ui/components/Dropdown.svelte';
    import ActionMenu from '@idstead/ui/components/ActionMenu.svelte';
    import Dialog from '@idstead/ui/components/Dialog.svelte';
    import ConfirmationDialog from '@idstead/ui/components/ConfirmationDialog.svelte';
    import FormField from '@idstead/ui/components/FormField.svelte';
    import FilterToolbar from '@idstead/ui/components/filter/FilterToolbar.svelte';
    import type { FilterMenuGroup } from '@idstead/ui/components/filter/filterMenu.ts';
    import SearchResultCount from '@idstead/ui/components/filter/SearchResultCount.svelte';
    import LoadingState from '@idstead/ui/components/LoadingState.svelte';
    import ErrorState from '@idstead/ui/components/ErrorState.svelte';
    import EmptyState from '@idstead/ui/components/EmptyState.svelte';
    import { adminFetch } from '#app/adminClient.ts';
    import { readJson } from '../../readJson.ts';
    import ActivityTimestamp from './ActivityTimestamp.svelte';

    const ENDPOINT = '/api/internal/admin/subscribers';
    const STATUS_LABELS: Record<SubscriberStatus, string> = {
        active: 'Active',
        pending: 'Pending',
        unsubscribed: 'Unsubscribed'
    };
    const STATUS_VARIANTS = {
        active: 'success',
        pending: 'warning',
        unsubscribed: 'default'
    } as const;
    const statusOptions = [
        { value: '', label: 'All' },
        ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))
    ];

    let rows = $state.raw<AdminSubscriber[]>([]);
    let total = $state(0);
    let pageSize = $state(25);
    let page = $state(1);
    let status = $state('');
    let search = $state('');
    let loading = $state(true);
    let error = $state('');
    let busy = $state(false);
    let adding = $state(false);
    let newEmail = $state('');
    let addError = $state('');
    let deleting = $state<AdminSubscriber | null>(null);
    let controller: AbortController | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let requestId = 0;

    const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));
    const filtered = $derived(Boolean(status || search.trim()));
    const blocked = $derived(loading || Boolean(error) || !rows.length);

    function errorMessage(body: unknown, fallback: string) {
        const value = body as { error?: { message?: string }; message?: string } | null;
        return value?.error?.message || value?.message || fallback;
    }

    async function load() {
        clearTimeout(debounce);
        controller?.abort();
        const currentController = new AbortController();
        controller = currentController;
        const currentRequest = ++requestId;
        const params = new URLSearchParams({ page: String(page) });
        if (status) params.set('status', status);
        if (search.trim()) params.set('q', search.trim());
        loading = true;
        error = '';
        try {
            const res = await adminFetch(`${ENDPOINT}?${params}`, {
                cache: 'no-store',
                signal: currentController.signal
            });
            const body = await readJson(res);
            if (currentRequest !== requestId) return;
            if (!res.ok) throw new Error(errorMessage(body, 'Could not load subscribers.'));
            rows = body.items;
            total = body.total;
            pageSize = body.pageSize;
            if (page > 1 && !rows.length && total > 0) {
                page = Math.max(1, Math.ceil(total / pageSize));
                void load();
            }
        } catch (err) {
            if (currentRequest === requestId && !currentController.signal.aborted)
                error = err instanceof Error ? err.message : 'Could not load subscribers.';
        } finally {
            if (currentRequest === requestId) loading = false;
        }
    }

    async function mutate(path: string, init: RequestInit, success: string) {
        busy = true;
        try {
            const res = await adminFetch(path, {
                ...init,
                headers: { 'Content-Type': 'application/json' }
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(errorMessage(body, 'The change could not be saved.'));
            }
            toastStore.success(success);
            await load();
            return true;
        } catch (err) {
            toastStore.error(err instanceof Error ? err.message : 'The change could not be saved.');
            return false;
        } finally {
            busy = false;
        }
    }

    async function addSubscriber() {
        addError = '';
        const email = newEmail.trim();
        if (!email) {
            addError = 'Enter an email address.';
            return;
        }
        const added = await mutate(
            ENDPOINT,
            { method: 'POST', body: JSON.stringify({ email }) },
            'Confirmation email sent.'
        );
        if (added) {
            adding = false;
            newEmail = '';
        }
    }

    function update(subscriber: AdminSubscriber, body: Record<string, string>, success: string) {
        void mutate(
            `${ENDPOINT}/${subscriber.id}`,
            { method: 'PATCH', body: JSON.stringify(body) },
            success
        );
    }

    async function confirmDelete() {
        if (!deleting) return;
        const deleted = await mutate(
            `${ENDPOINT}/${deleting.id}`,
            { method: 'DELETE' },
            'Subscriber deleted.'
        );
        if (deleted) deleting = null;
    }

    function setStatus(value: string) {
        status = value;
        page = 1;
        void load();
    }

    function searchChanged(value: string) {
        search = value;
        page = 1;
        controller?.abort();
        requestId++;
        loading = true;
        clearTimeout(debounce);
        debounce = setTimeout(load, 300);
    }

    onMount(() => {
        void load();
        return () => {
            requestId++;
            controller?.abort();
            clearTimeout(debounce);
        };
    });

    const menuGroups = $derived<FilterMenuGroup[]>([
        {
            label: 'Status',
            mode: 'single',
            options: statusOptions,
            selected: [status],
            defaultValue: '',
            onSelect: setStatus
        }
    ]);

    function statusAction(item: AdminSubscriber) {
        if (item.status === 'pending')
            return {
                label: 'Resend confirmation',
                icon: Send,
                onSelect: () => update(item, { action: 'resend' }, 'Confirmation email sent.')
            };
        if (item.status === 'active')
            return {
                label: 'Unsubscribe',
                icon: MailX,
                onSelect: () => update(item, { status: 'unsubscribed' }, 'Subscriber unsubscribed.')
            };
        if (item.confirmed_at)
            return {
                label: 'Reactivate',
                icon: MailCheck,
                onSelect: () => update(item, { status: 'active' }, 'Subscriber reactivated.')
            };
        return {
            label: 'Send confirmation',
            icon: Send,
            onSelect: () =>
                void mutate(
                    ENDPOINT,
                    { method: 'POST', body: JSON.stringify({ email: item.email }) },
                    'Confirmation email sent.'
                )
        };
    }

    function actionsFor(item: AdminSubscriber) {
        return [
            statusAction(item),
            {
                label: 'Delete subscriber',
                icon: Trash,
                danger: true,
                onSelect: () => (deleting = item)
            }
        ];
    }

    function subscriber(row: Record<string, unknown>) {
        return row as unknown as AdminSubscriber;
    }
</script>

<Section
    spacing="none"
    class="flex min-w-0 flex-col gap-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
            <h1 class="type-page-title">Subscribers</h1>
            <p class="mt-1 type-body text-fg-secondary">
                Newsletter emails. New addresses get a confirmation link before they receive posts.
            </p>
        </div>
        <Button
            type="primary"
            size="sm"
            onclick={() => {
                addError = '';
                adding = true;
            }}>
            {#snippet leading()}<Plus class="size-3.5" />{/snippet}Add subscriber
        </Button>
    </div>
    <DataTable
        title="All subscribers"
        caption="Newsletter subscribers"
        data={rows as unknown as Record<string, unknown>[]}
        class="min-w-2xl"
        state={blocked ? tableState : undefined}
        footer={!blocked && totalPages > 1 ? pagination : undefined}
        columns={[
            { key: 'email', header: 'Email', width: '36%' },
            { key: 'status', header: 'Status', width: '14%' },
            { key: 'created_at', header: 'Added', width: '18%' },
            { key: 'confirmed_at', header: 'Confirmed', width: '18%' },
            { key: 'actions', header: '', srHeader: 'Actions', width: '14%', align: 'right' }
        ]}>
        {#snippet meta()}
            {#if !error}<SearchResultCount
                    count={rows.length}
                    {total}
                    {loading}
                    itemLabel="subscribers" />{/if}
        {/snippet}
        {#snippet toolbar()}
            <FilterToolbar
                embedded
                title="Subscriber filters"
                mobileGroups={menuGroups}>
                {#snippet searchSlot()}
                    <Input
                        type="search"
                        aria-label="Search subscribers"
                        placeholder="Search emails…"
                        value={search}
                        maxlength={254}
                        oninput={event => searchChanged(event.currentTarget.value)} />
                {/snippet}
                {#snippet filterControlsSlot()}
                    <Dropdown
                        label="Status"
                        value={status}
                        options={statusOptions}
                        onChange={setStatus} />
                {/snippet}
            </FilterToolbar>
        {/snippet}
        {#snippet cell(row, key)}
            {@const item = subscriber(row)}
            {#if key === 'status'}
                <Badge variant={STATUS_VARIANTS[item.status]}>{STATUS_LABELS[item.status]}</Badge>
            {:else if key === 'created_at'}
                <ActivityTimestamp date={item.created_at} />
            {:else if key === 'confirmed_at'}
                {#if item.confirmed_at}<ActivityTimestamp date={item.confirmed_at} />{:else}—{/if}
            {:else if key === 'actions'}
                <ActionMenu
                    ariaLabel={`Actions for ${item.email}`}
                    disabled={busy}
                    items={actionsFor(item)} />
            {:else}
                <span
                    class="block truncate"
                    title={item.email}>{item.email}</span>
            {/if}
        {/snippet}
    </DataTable>
</Section>

<Dialog
    bind:isOpen={adding}
    title="Add subscriber"
    description="The address gets a confirmation link and receives posts only after confirming."
    size="sm"
    onClose={() => (adding = false)}>
    <form
        class="flex flex-col gap-4"
        onsubmit={event => {
            event.preventDefault();
            void addSubscriber();
        }}>
        <FormField
            id="subscriber-email"
            label="Email"
            required
            error={addError}>
            <Input
                id="subscriber-email"
                type="email"
                bind:value={newEmail}
                maxlength={254}
                autocomplete="off"
                disabled={busy} />
        </FormField>
        <div class="flex justify-end gap-2">
            <Button
                type="ghost"
                size="sm"
                onclick={() => (adding = false)}
                disabled={busy}>
                Cancel
            </Button>
            <Button
                type="primary"
                size="sm"
                htmlType="submit"
                isLoading={busy}>
                Send confirmation
            </Button>
        </div>
    </form>
</Dialog>

<ConfirmationDialog
    isOpen={deleting !== null}
    title="Delete this subscriber?"
    message={`${deleting?.email ?? ''} is removed permanently and stops receiving posts. Adding it again needs a new confirmation.`}
    confirmLabel="Delete subscriber"
    isDestructive
    isLoading={busy}
    onConfirm={confirmDelete}
    onCancel={() => (deleting = null)} />

{#snippet tableState()}
    <div {@attach stableHeight}>
        {#if loading}
            <LoadingState
                variant="skeleton"
                label="Loading subscribers…" />
        {:else if error}
            <ErrorState
                description={error}
                onRetry={load} />
        {:else}
            <EmptyState
                icon={filtered ? Search : Mail}
                title={filtered ? 'No matching subscribers' : 'No subscribers yet'}
                description={filtered ?
                    'Try another search or status.'
                :   'Addresses that subscribe or that you add appear here.'} />
        {/if}
    </div>
{/snippet}

{#snippet pagination()}
    <Pagination
        {page}
        {totalPages}
        onPageChange={value => {
            page = value;
            void load();
        }}
        size="sm" />
{/snippet}
