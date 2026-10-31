<script lang="ts">
    import { stableHeight } from '@idstead/ui/utils/stableHeight.ts';
    import { readJson } from '../../readJson.ts';
    import { onMount } from 'svelte';
    import { Download, FileText, Search, Logs } from '@lucide/svelte';
    import { SvelteURLSearchParams } from 'svelte/reactivity';
    import { adminFetch } from '#app/adminClient.ts';
    import { toastStore } from '@idstead/ui';
    import {
        activityCategories,
        activityLogSortFields,
        ACTIVITY_LOG_PAGE_SIZE,
        ACTIVITY_LOG_EXPORT_LIMIT,
        type ActivityLogEntry,
        type ActivityLogSortField
    } from '#lib/activityLog.ts';
    import { shouldShowDataControls } from '#lib/adminWorkspace.ts';
    import Section from '@idstead/ui/layout/Section.svelte';
    import DataTable from '@idstead/ui/components/DataTable.svelte';
    import Pagination from '@idstead/ui/components/Pagination.svelte';
    import Button from '@idstead/ui/components/Button.svelte';
    import Badge from '@idstead/ui/components/Badge.svelte';
    import Input from '@idstead/ui/components/Input.svelte';
    import Dropdown from '@idstead/ui/components/Dropdown.svelte';
    import FilterToolbar from '@idstead/ui/components/filter/FilterToolbar.svelte';
    import SortControl from '@idstead/ui/components/filter/SortControl.svelte';
    import {
        sortMenuGroups,
        type FilterMenuGroup
    } from '@idstead/ui/components/filter/filterMenu.ts';
    import SearchResultCount from '@idstead/ui/components/filter/SearchResultCount.svelte';
    import LoadingState from '@idstead/ui/components/LoadingState.svelte';
    import ErrorState from '@idstead/ui/components/ErrorState.svelte';
    import EmptyState from '@idstead/ui/components/EmptyState.svelte';
    import ActivityTimestamp from './ActivityTimestamp.svelte';

    let rows = $state.raw<ActivityLogEntry[]>([]);
    let total = $state(0);
    let page = $state(1);
    let category = $state('');
    let search = $state('');
    let sort = $state<ActivityLogSortField>('created_at');
    let direction = $state<'asc' | 'desc'>('desc');
    let loading = $state(true);
    let error = $state('');
    let exporting = $state<'pdf' | 'txt' | null>(null);
    let controller: AbortController | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let requestId = 0;

    const totalPages = $derived(Math.max(1, Math.ceil(total / ACTIVITY_LOG_PAGE_SIZE)));
    const blocked = $derived(loading || Boolean(error) || !rows.length);
    const filtered = $derived(Boolean(category || search.trim()));
    const showDataControls = $derived(shouldShowDataControls(total, filtered));

    function buildParams(extra: Record<string, string> = {}) {
        const params = new SvelteURLSearchParams({ ...extra, sort, direction });
        if (category) params.set('category', category);
        if (search.trim()) params.set('query', search.trim());
        return params;
    }

    async function load() {
        clearTimeout(debounce);
        controller?.abort();
        const currentController = new AbortController();
        controller = currentController;
        const currentRequest = ++requestId;
        const params = buildParams({
            limit: String(ACTIVITY_LOG_PAGE_SIZE),
            offset: String((page - 1) * ACTIVITY_LOG_PAGE_SIZE)
        });
        loading = true;
        error = '';
        try {
            const res = await adminFetch(`/api/internal/admin/activity-log?${params}`, {
                cache: 'no-store',
                signal: currentController.signal
            });
            const body = await readJson(res);
            if (currentRequest !== requestId) return;
            if (!res.ok)
                throw new Error(
                    body?.error?.message || body?.message || 'Could not load activity log.'
                );
            rows = body.data;
            total = body.total;
            const lastPage = Math.max(1, Math.ceil(total / ACTIVITY_LOG_PAGE_SIZE));
            if (page > lastPage) {
                page = lastPage;
                void load();
            }
        } catch (err) {
            if (currentRequest === requestId && !currentController.signal.aborted)
                error = err instanceof Error ? err.message : 'Could not load activity log.';
        } finally {
            if (currentRequest === requestId) loading = false;
        }
    }

    function filter() {
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

    async function exportLog(format: 'pdf' | 'txt') {
        if (exporting) return;
        const params = buildParams({ format });
        exporting = format;
        try {
            const res = await adminFetch(`/api/internal/admin/activity-log/export?${params}`, {
                cache: 'no-store'
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error?.message || body?.message || 'Export failed.');
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.${format}`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            toastStore.error(err instanceof Error ? err.message : 'Export failed.');
        } finally {
            exporting = null;
        }
    }

    onMount(() => {
        void load();
        return () => {
            requestId++;
            controller?.abort();
            clearTimeout(debounce);
        };
    });

    function setCategory(value: string) {
        category = value;
        filter();
    }

    function setSortField(value: string) {
        const selected = activityLogSortFields.find(field => field.value === value);
        if (!selected) return;
        sort = selected.value;
        direction = sort === 'created_at' ? 'desc' : 'asc';
        filter();
    }

    function toggleDirection() {
        direction = direction === 'desc' ? 'asc' : 'desc';
        filter();
    }

    const categoryOptions = $derived([{ value: '', label: 'All' }, ...activityCategories]);
    const menuGroups = $derived<FilterMenuGroup[]>([
        {
            label: 'Category',
            mode: 'single',
            options: categoryOptions,
            selected: [category],
            defaultValue: '',
            onSelect: setCategory
        },
        ...sortMenuGroups({
            fields: [...activityLogSortFields],
            field: sort,
            direction,
            onFieldChange: setSortField,
            onDirectionToggle: toggleDirection
        })
    ]);
</script>

<Section
    spacing="none"
    class="flex min-w-0 flex-col gap-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
            <h1 class="type-page-title">Activity Log</h1>
            <p class="mt-1 type-body text-fg-secondary">Admin activity from the last 30 days.</p>
        </div>
        {#if total > 0}
            <div class="flex shrink-0 flex-col gap-2 sm:items-end">
                <div class="flex flex-wrap items-center gap-2">
                    <Button
                        type="secondary"
                        size="sm"
                        isLoading={exporting === 'txt'}
                        disabled={exporting !== null || loading || Boolean(error) || total === 0}
                        onclick={() => exportLog('txt')}>
                        {#snippet leading()}<FileText class="size-3.5" />{/snippet}Export TXT
                    </Button>
                    <Button
                        type="secondary"
                        size="sm"
                        isLoading={exporting === 'pdf'}
                        disabled={exporting !== null || loading || Boolean(error) || total === 0}
                        onclick={() => exportLog('pdf')}>
                        {#snippet leading()}<Download class="size-3.5" />{/snippet}Export PDF
                    </Button>
                </div>
                {#if total > ACTIVITY_LOG_EXPORT_LIMIT && !loading && !error}
                    <p class="max-w-sm text-xs text-fg-muted sm:text-right">
                        Exports include the first 5,000 matching activities in the selected order.
                    </p>
                {/if}
            </div>
        {/if}
    </div>
    <DataTable
        title="All activity"
        caption="Admin activity log"
        data={rows}
        class="min-w-3xl"
        state={blocked ? tableState : undefined}
        footer={!blocked ? pagination : undefined}
        columns={[
            { key: 'category', header: 'Category', width: '10%' },
            { key: 'action', header: 'Action', width: '16%' },
            { key: 'actor', header: 'Actor', width: '16%' },
            { key: 'summary', header: 'Details', width: '24%' },
            { key: 'ip', header: 'IP', width: '16%' },
            { key: 'created_at', header: 'Time', width: '18%' }
        ]}>
        {#snippet meta()}
            {#if showDataControls && !error}<SearchResultCount
                    count={rows.length}
                    {total}
                    {loading}
                    itemLabel="activities" />{/if}
        {/snippet}
        {#snippet toolbar()}
            {#if showDataControls}
                <FilterToolbar
                    embedded
                    title="Activity filters"
                    mobileGroups={menuGroups}>
                    {#snippet searchSlot()}
                        <Input
                            type="search"
                            aria-label="Search activity log"
                            placeholder="Search actions, actors, or details…"
                            value={search}
                            maxlength={250}
                            oninput={event => searchChanged(event.currentTarget.value)} />
                    {/snippet}
                    {#snippet filterControlsSlot()}
                        <Dropdown
                            label="Category"
                            value={category}
                            options={categoryOptions}
                            onChange={setCategory} />
                    {/snippet}
                    {#snippet sortSlot()}
                        <SortControl
                            fields={[...activityLogSortFields]}
                            currentField={sort}
                            currentDirection={direction}
                            onFieldChange={setSortField}
                            onDirectionToggle={toggleDirection} />
                    {/snippet}
                </FilterToolbar>
            {/if}
        {/snippet}
        {#snippet cell(row, key)}
            {#if key === 'category'}
                <Badge
                    variant={row.category === 'security' ? 'warning'
                    : row.category === 'settings' ? 'default'
                    : 'accent'}
                    >{activityCategories.find(item => item.value === row.category)?.label
                        ?? row.category}</Badge>
            {:else if key === 'created_at'}
                <ActivityTimestamp date={row.created_at as string} />
            {:else}
                <span title={String(row[key] ?? '')}>{row[key] ?? '—'}</span>
            {/if}
        {/snippet}
    </DataTable>
</Section>

{#snippet tableState()}
    <div {@attach stableHeight}>
        {#if loading}
            <LoadingState
                variant="skeleton"
                label="Loading activity log…" />
        {:else if error}
            <ErrorState
                description={error}
                onRetry={load} />
        {:else}
            <EmptyState
                icon={filtered ? Search : Logs}
                title={filtered ? 'No matching activities' : 'No activity yet'}
                description={filtered ?
                    'Try another search or category.'
                :   'Admin actions will appear here.'} />
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
