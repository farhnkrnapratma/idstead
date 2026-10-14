<script lang="ts">
    import { adminUrl, navigateAdmin } from '#lib/adminNavigation.ts';
    import { onMount, tick } from 'svelte';
    import {
        ArrowLeft,
        CheckCheck,
        Check,
        ChevronRight,
        Pin,
        PinOff,
        Trash,
        Flag,
        Calendar,
        Hash
    } from '@lucide/svelte';
    import { analyticsPeriod, browserTimeZone } from '#lib/adminAnalytics.ts';
    import { adminActivityRequest } from '#lib/adminActivityClient.ts';
    import { WorkspaceFeed } from '#lib/stores/workspaceFeed.svelte.ts';
    import { adminNotificationsStore as inbox } from '#lib/stores/adminNotificationsStore.svelte.ts';
    import { adminChartRangeStore } from '#lib/stores/adminChartRangeStore.svelte.ts';
    import { adminDisplayStore } from '#lib/stores/adminDisplayStore.svelte.ts';
    import { pluralize } from '#lib/utils/pluralize.ts';
    import {
        notificationTypes,
        formatCount,
        shouldShowDataControls,
        majorityPercent,
        type WorkspaceArea,
        type WorkspaceRow,
        type WorkspaceOverview,
        type WorkspacePage,
        type AnalyticsBucket,
        ADMIN_WORKSPACE_PAGE_SIZE
    } from '#lib/adminWorkspace.ts';
    import { REPORT_REASONS, reportReasonLabel, reportReasonColor } from '#lib/reportReasons.ts';
    import {
        activitySentence,
        activityTimestamp,
        type AdminNotificationRow,
        type ClearOperation
    } from '#lib/adminActivity.ts';
    import Section from '#lib/layout/Section.svelte';
    import Avatar from '../Avatar.svelte';
    import Card from '../Card.svelte';
    import Button from '../Button.svelte';
    import Input from '../Input.svelte';
    import Dropdown from '../Dropdown.svelte';
    import Pagination from '../Pagination.svelte';
    import LoadingState from '../LoadingState.svelte';
    import ErrorState from '../ErrorState.svelte';
    import EmptyState from '../EmptyState.svelte';
    import ConfirmationDialog from '../ConfirmationDialog.svelte';
    import FieldMessage from '../FieldMessage.svelte';
    import FilterToolbar from '../filter/FilterToolbar.svelte';
    import SortControl from '../filter/SortControl.svelte';
    import SearchResultCount from '../filter/SearchResultCount.svelte';
    import DataTable, { type DataTableColumn } from '../DataTable.svelte';
    import ActionMenu from '../ActionMenu.svelte';
    import Badge from '../Badge.svelte';
    import ActivityRow from './ActivityRow.svelte';
    import ActivityBadge from './ActivityBadge.svelte';
    import ActivityPageLink from './ActivityPageLink.svelte';
    import ActivityDetails from './ActivityDetails.svelte';
    import ActivityTimestamp from './ActivityTimestamp.svelte';
    import CategoryTrendChart from './CategoryTrendChart.svelte';
    import type { ViewsRange } from './viewsRange';
    let {
        area,
        onSelectNotification
    }: { area: WorkspaceArea; onSelectNotification: (item: AdminNotificationRow) => void } =
        $props();
    const PAGE_SIZE = ADMIN_WORKSPACE_PAGE_SIZE;
    const list = new WorkspaceFeed();
    const detail = new WorkspaceFeed();
    let search = $state('');
    let detailSearch = $state('');
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let detailDebounce: ReturnType<typeof setTimeout> | undefined;
    let autoRefresh: ReturnType<typeof setTimeout> | undefined;
    let busy = $state(false);
    let actionError = $state('');
    let confirmation = $state<'group' | 'all' | null>(null);
    let clearOperation = $state.raw<ClearOperation | null>(null);
    let preparedGroup = $state.raw<{
        id: string;
        asOf: string;
        timeZone: string;
        count: number;
    } | null>(null);
    let groupCount = $state<number | null>(null);
    let detailTitle = $state('');
    let analytics = $state.raw<AnalyticsBucket[]>([]);
    let analyticsLoading = $state(true);
    let analyticsError = $state('');
    let detailAnalytics = $state.raw<AnalyticsBucket[]>([]);
    let detailAnalyticsLoading = $state(true);
    let detailAnalyticsError = $state('');
    const params = $derived(adminUrl().searchParams);
    const selected = $derived(params.get('selected') ?? '');
    const title = $derived(
        area === 'reports' ? 'Reported comments'
        : area === 'feedback' ? 'User feedback'
        : 'Notifications'
    );
    const timeZone = browserTimeZone();
    const source = $derived(
        area === 'reports' ? 'report_events'
        : area === 'feedback' ? 'feedback_events'
        : 'notification_events'
    );
    const sortFields = $derived([
        { value: 'date', label: 'Latest' },
        { value: 'page', label: 'Page title' },
        ...(area === 'notifications' ? [{ value: 'type', label: 'Category' }]
        : area === 'reports' ? [{ value: 'total', label: 'Report count' }]
        : [
                { value: 'total', label: 'Response count' },
                { value: 'helpful', label: 'Helpful percentage' }
            ])
    ]);
    const readCount = $derived(Math.max(0, inbox.total - inbox.unreadCount));
    function navigate(values: Record<string, string | null>, replace = false) {
        const url = adminUrl();
        for (const [key, value] of Object.entries(values))
            if (value) url.searchParams.set(key, value);
            else url.searchParams.delete(key);
        navigateAdmin(url, replace);
    }
    function filter(values: Record<string, string>) {
        list.invalidate();
        navigate({
            ...values,
            page: null,
            asOf: null,
            selected: null,
            detailPage: null,
            focus: null
        });
    }
    function definedEntries(values: Record<string, string>) {
        return Object.fromEntries(Object.entries(values).filter(([, v]) => v));
    }
    function options(isDetail = false) {
        const values = Object.fromEntries(params);
        const query: Record<string, string> = {
            ...values,
            ...definedEntries(analyticsPeriod(defaultRange, timeZone, new Date())),
            section: isDetail ? source : area
        };
        for (const key of [
            'tab',
            'selected',
            'page',
            'detailPage',
            'detailQuery',
            'detailReason',
            'detailSort',
            'detailDirection',
            'vote',
            'start',
            'end',
            'history'
        ])
            delete query[key];
        if (isDetail) {
            query.id = selected;
            if (params.has('notificationId')) query.notificationId = params.get('notificationId')!;
            if (area === 'feedback') query.history = 'true';
            query.query = params.get('detailQuery') ?? '';
            query.reason = params.get('detailReason') ?? '';
            query.vote = params.get('vote') ?? 'all';
            query.type = 'all';
            query.read = 'all';
            query.sort =
                area === 'reports' || area === 'feedback' ?
                    (params.get('detailSort') ?? 'date')
                :   'date';
            query.direction = params.get('detailDirection') ?? 'desc';
            if (area === 'reports') delete query.focus;
            else if (params.has('focus')) query.focus = params.get('focus')!;
            if (params.has('detailPage')) query.page = params.get('detailPage')!;
        } else {
            delete query.focus;
            delete query.notificationId;
            if (params.has('page')) query.page = params.get('page')!;
        }
        return query;
    }
    function relevantKey(query: Record<string, string>) {
        const { asOf, from, to, ...rest } = query;
        return JSON.stringify(rest);
    }
    let lastListKey = '';
    let lastDetailKey = '';
    let lastAnalyticsKey = '';
    async function loadAnalytics(force = false) {
        if (area === 'notifications') return;
        if (!force && trendRange === lastAnalyticsKey) return;
        lastAnalyticsKey = trendRange;
        analyticsLoading = true;
        try {
            const { from, to, ...rest } = options();
            const result = await adminActivityRequest<WorkspaceOverview>('workspace', {
                ...rest,
                section: 'overview',
                range: trendRange
            });
            analytics = result.series;
            analyticsError = '';
        } catch (caught) {
            analyticsError = caught instanceof Error ? caught.message : 'Unable to load trend.';
        } finally {
            analyticsLoading = false;
        }
    }
    let lastDetailAnalyticsKey = '';
    async function loadDetailAnalytics() {
        if (area !== 'feedback' || !selected) return;
        const key = `${trendRange}:${selected}`;
        if (key === lastDetailAnalyticsKey) return;
        lastDetailAnalyticsKey = key;
        detailAnalyticsLoading = true;
        try {
            const result = await adminActivityRequest<WorkspacePage>('workspace', {
                ...analyticsPeriod(trendRange, timeZone, new Date()),
                section: 'feedback_events',
                id: selected,
                events: 'false'
            });
            detailAnalytics = result.series ?? [];
            detailAnalyticsError = '';
        } catch (caught) {
            detailAnalyticsError =
                caught instanceof Error ? caught.message : 'Unable to load trend.';
        } finally {
            detailAnalyticsLoading = false;
        }
    }
    function setChartRange(next: ViewsRange) {
        adminChartRangeStore.set(next);
        void loadAnalytics();
        void loadDetailAnalytics();
    }
    function sync() {
        search = params.get('query') ?? '';
        detailSearch = params.get('detailQuery') ?? '';
        const listOptions = options();
        const listKey = relevantKey(listOptions);
        if (listKey !== lastListKey) {
            lastListKey = listKey;
            void list.load(listOptions);
        }
        if (selected) {
            const detailOptions = options(true);
            const detailKey = relevantKey(detailOptions);
            if (detailKey !== lastDetailKey) {
                lastDetailKey = detailKey;
                void detail.load(detailOptions);
                if (area === 'feedback') void loadDetailAnalytics();
            }
        } else {
            lastDetailKey = '';
        }
        void loadAnalytics();
    }
    async function open(item: WorkspaceRow) {
        groupCount = item.total;
        detailTitle = item.title;
        detail.invalidate();
        navigate({
            selected: item.id,
            notificationId: null,
            history: null,
            detailPage: null,
            detailQuery: null,
            detailReason: null,
            vote: null,
            focus: null
        });
        await tick();
        document.getElementById('workspace-detail')?.focus();
    }
    async function selectEvent(event: AdminNotificationRow) {
        if (busy || inbox.isMutating) return;
        if (!event.read_at) {
            if (!(await inbox.markRead(event.id))) return;
            if (list.data)
                list.data = {
                    ...list.data,
                    items: list.data.items.map(row =>
                        row.id === event.id ?
                            { ...row, event: { ...event, read_at: new Date().toISOString() } }
                        :   row
                    )
                };
        }
        await refresh();
        onSelectNotification(event);
    }
    async function deleteEvent(id: string) {
        if (busy || inbox.isMutating) return;
        if (await inbox.dismiss(id)) await refresh();
    }
    async function refresh() {
        list.invalidate();
        detail.invalidate();
        navigate({ asOf: null }, true);
        await tick();
        void loadAnalytics(true);
        await list.load(options(), true);
        const lastPage = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE));
        if (!list.error && Number(params.get('page') ?? 1) > lastPage) {
            goToPage(false, lastPage);
            await tick();
            await list.load(options(), true);
        }
        if (selected) await detail.load(options(true), true);
        await inbox.load();
    }
    function goToPage(isDetail: boolean, page: number) {
        const value = page > 1 ? String(page) : null;
        if (isDetail) navigate({ detailPage: value });
        else navigate({ page: value, asOf: value ? (list.data?.asOf ?? null) : null });
    }
    async function groupAction(remove = false) {
        const target =
            preparedGroup
            ?? (detail.data ?
                {
                    id: selected,
                    asOf: detail.data.asOf,
                    timeZone,
                    count: groupCount ?? detail.data.total ?? 0
                }
            :   null);
        if (!target) return;
        busy = true;
        actionError = '';
        try {
            await adminActivityRequest(
                'workspace',
                {},
                { action: remove ? 'delete_group' : 'read_group', ...target, ...detail.data?.scope }
            );
            confirmation = null;
            preparedGroup = null;
            if (remove) navigate({ selected: null, detailPage: null }, true);
            await refresh();
        } catch (caught) {
            actionError =
                caught instanceof Error ? caught.message : 'Unable to update notifications.';
        } finally {
            busy = false;
        }
    }
    async function prepareClear() {
        busy = true;
        actionError = '';
        try {
            clearOperation = await inbox.prepareClear(crypto.randomUUID());
            confirmation = 'all';
        } catch (caught) {
            actionError = caught instanceof Error ? caught.message : 'Unable to prepare deletion.';
        } finally {
            busy = false;
        }
    }
    async function confirmDelete() {
        if (confirmation === 'group') return groupAction(true);
        if (!clearOperation) return;
        busy = true;
        try {
            await inbox.clear(clearOperation.operationId);
            confirmation = null;
            await refresh();
        } catch (caught) {
            actionError =
                caught instanceof Error ? caught.message : 'Unable to delete notifications.';
        } finally {
            busy = false;
        }
    }
    function updateDetail(values: Record<string, string>) {
        detail.invalidate();
        navigate({ ...values, detailPage: null, focus: null });
    }
    function date(value: string) {
        return activityTimestamp(value, timeZone, adminDisplayStore.current);
    }
    const defaultRange = $derived(area === 'feedback' ? '1y' : 'all');
    const trendRange = $derived(adminChartRangeStore.current);
    const rows = $derived((list.data?.items ?? []) as unknown as WorkspaceRow[]);
    const notificationRows = $derived(
        rows.filter(row => row.event) as unknown as Record<string, unknown>[]
    );
    const historyRows = $derived(
        (detail.data?.items ?? []).filter(
            row => (row as unknown as WorkspaceRow).event
        ) as unknown as Record<string, unknown>[]
    );
    const listColumns: DataTableColumn[] = $derived(
        area === 'notifications' ?
            [
                { key: 'activity', header: 'Activity', width: '12%' },
                { key: 'page', header: 'Page', width: '22%' },
                { key: 'details', header: 'Details', width: '40%' },
                { key: 'time', header: 'Time', width: '12%' },
                {
                    key: 'actions',
                    header: '',
                    srHeader: 'Actions',
                    align: 'right',
                    width: '14%',
                    class: 'overflow-visible'
                }
            ]
        : area === 'reports' ?
            [
                { key: 'page', header: 'Page', width: '24%' },
                { key: 'author', header: 'Author', width: '16%' },
                { key: 'reason', header: 'Reason', width: '18%' },
                { key: 'total', header: 'Reports', align: 'right', width: '8%' },
                { key: 'latest', header: 'Last activity', width: '24%' },
                {
                    key: 'actions',
                    header: '',
                    srHeader: 'Actions',
                    align: 'right',
                    width: '10%',
                    class: 'overflow-visible'
                }
            ]
        :   [
                { key: 'page', header: 'Page', width: '34%' },
                { key: 'score', header: 'Score', width: '22%' },
                { key: 'total', header: 'Responses', align: 'right', width: '10%' },
                { key: 'latest', header: 'Last activity', width: '24%' },
                {
                    key: 'actions',
                    header: '',
                    srHeader: 'Actions',
                    align: 'right',
                    width: '10%',
                    class: 'overflow-visible'
                }
            ]
    );
    const listBlocked = $derived(
        Boolean((list.loading && !list.data) || (list.data && !list.data.items.length))
    );
    const listFiltersActive = $derived(
        Boolean(search.trim())
            || (area === 'reports' && Boolean(params.get('reason')))
            || (area === 'feedback' && Boolean(params.get('type') && params.get('type') !== 'all'))
            || (area === 'notifications'
                && Boolean(
                    (params.get('type') && params.get('type') !== 'all')
                    || (params.get('read') && params.get('read') !== 'all')
                ))
    );
    const showListControls = $derived(
        Boolean(list.loading && !list.data)
            || shouldShowDataControls(list.data?.total ?? 0, listFiltersActive)
    );
    const detailFiltersActive = $derived(
        (area === 'reports' && Boolean(detailSearch.trim() || params.get('detailReason')))
            || (area === 'feedback' && Boolean(params.get('vote') && params.get('vote') !== 'all'))
    );
    const showDetailControls = $derived(
        Boolean(detail.loading && !detail.data)
            || shouldShowDataControls(detail.data?.total ?? 0, detailFiltersActive)
    );
    const historyTitle = $derived(
        area === 'reports' ? 'Report history'
        : area === 'feedback' ? 'Response history'
        : 'Notification history'
    );
    const historyColumns: DataTableColumn[] = $derived(
        area === 'notifications' ?
            [
                { key: 'activity', header: 'Activity', width: '14%' },
                { key: 'page', header: 'Page', width: '26%' },
                { key: 'details', header: 'Details', width: '30%' },
                { key: 'time', header: 'Time', width: '18%' },
                {
                    key: 'actions',
                    header: '',
                    srHeader: 'Actions',
                    align: 'right',
                    width: '12%',
                    class: 'overflow-visible'
                }
            ]
        : area === 'reports' ?
            [
                { key: 'reason', header: 'Reason', width: '20%' },
                { key: 'details', header: 'Details', width: '55%' },
                { key: 'time', header: 'Time', width: '25%' }
            ]
        :   [
                { key: 'response', header: 'Response', width: '40%' },
                { key: 'time', header: 'Time', width: '60%' }
            ]
    );
    function openEvent(entry: WorkspaceRow) {
        if (busy || inbox.isMutating || !entry.event) return;
        void selectEvent(entry.event);
    }
    async function readEvent(entry: WorkspaceRow) {
        if (busy || inbox.isMutating || !entry.event?.id) return;
        if (await inbox.markRead(entry.id)) await refresh();
    }
    async function openHistoryEvent(entry: WorkspaceRow) {
        if (busy || inbox.isMutating || !entry.event) return;
        await inbox.markRead(entry.id);
        onSelectNotification(entry.event);
    }
    async function pinEvent(entry: WorkspaceRow, pinned: boolean) {
        if (busy || inbox.isMutating) return;
        if (await inbox.setPinned(entry.id, pinned)) await refresh();
    }
    const chartSeries = $derived(
        area === 'reports' ?
            REPORT_REASONS.map(r => ({ key: r.id, label: r.label, color: reportReasonColor(r.id) }))
        :   [
                { key: 'helpful', label: 'Helpful', color: 'var(--color-activity-helpful)' },
                { key: 'unhelpful', label: 'Unhelpful', color: 'var(--color-activity-unhelpful)' }
            ]
    );
    const chartRows = $derived(
        area === 'reports' ?
            analytics.map(b => ({
                bucket: b.bucket,
                ...Object.fromEntries(REPORT_REASONS.map(r => [r.id, b.reports?.[r.id] ?? 0]))
            }))
        :   analytics.map(b => ({ bucket: b.bucket, helpful: b.helpful, unhelpful: b.unhelpful }))
    );
    const detailChartRows = $derived(
        detailAnalytics.map(b => ({ bucket: b.bucket, helpful: b.helpful, unhelpful: b.unhelpful }))
    );
    onMount(() => {
        adminChartRangeStore.init();
        const remove = inbox.onActivityRefresh(async () => {
            clearTimeout(autoRefresh);
            autoRefresh = setTimeout(() => void refresh(), 1000);
        });
        return () => {
            clearTimeout(debounce);
            clearTimeout(detailDebounce);
            clearTimeout(autoRefresh);
            list.dispose();
            detail.dispose();
            remove();
        };
    });
</script>

<Section
    spacing="none"
    class="flex min-w-0 flex-col gap-4">
    <div
        {@attach () => {
            params.toString();
            sync();
        }}>
        <h1 class="type-page-title">{title}</h1>
        <p class="mt-1 type-body text-text-secondary">
            {area === 'reports' ? 'Review flagged comments and decide what to do.'
            : area === 'feedback' ? 'See how readers rate your articles and pages.'
            : 'Recent activity across your site.'}
        </p>
    </div>
    {#if actionError}<FieldMessage message={actionError} />{/if}
    {#if inbox.activityError}<FieldMessage message={inbox.activityError} />{/if}
    <div class="min-w-0">
        <div class={selected ? 'hidden' : 'flex min-w-0 flex-col gap-4'}>
            {#if area !== 'notifications'}
                <Card density="compact">
                    <CategoryTrendChart
                        title={area === 'reports' ? 'Reports over time' : 'Feedback over time'}
                        description={area === 'reports' ?
                            'All reported comments across every page, by category.'
                        :   'Helpful vs. unhelpful responses across every page.'}
                        data={chartRows}
                        series={chartSeries}
                        {timeZone}
                        isLoading={analyticsLoading}
                        error={analyticsError}
                        range={trendRange}
                        onRangeChange={setChartRange}
                        onRetry={loadAnalytics}
                        allowDonut
                        donutUnit={area === 'reports' ? 'reports' : 'responses'} />
                </Card>
            {/if}

            {#if list.error}<ErrorState
                    title="Unable to load results"
                    description={list.error}
                    onRetry={() => list.load(options(), true)} />{/if}
            {#if area === 'notifications'}
                <DataTable
                    title={`All ${title.toLowerCase()}`}
                    meta={showListControls ? listCount : undefined}
                    toolbar={showListControls ? listToolbar : undefined}
                    state={listBlocked ? listStateView : undefined}
                    footer={listBlocked ? undefined : listPagination}
                    caption={title}
                    header={notificationRows.length ? notificationActions : undefined}
                    columns={listColumns}
                    data={notificationRows}
                    rowClass={row =>
                        (row as unknown as WorkspaceRow).event?.read_at ?
                            ''
                        :   'bg-notification-unread hover:bg-notification-unread-hover'}
                    onRowSelect={row => openEvent(row as unknown as WorkspaceRow)}>
                    {#snippet cell(row, key)}
                        {@const entry = row as unknown as WorkspaceRow}
                        {@const event = entry.event as AdminNotificationRow}
                        {#if key === 'activity'}
                            <span class="flex items-center gap-1.5">
                                <ActivityBadge
                                    kind={event.kind}
                                    vote={event.meta?.vote} />
                                {#if event.pinned_at}<Pin
                                        class="size-3 shrink-0 text-text-muted"
                                        aria-label="Pinned" />{/if}
                            </span>
                        {:else if key === 'page'}
                            <ActivityPageLink item={event} />
                        {:else if key === 'details'}
                            <span class="flex min-w-0 items-center gap-x-2 leading-4">
                                <ActivityDetails
                                    item={event}
                                    withAuthor />
                            </span>
                        {:else if key === 'time'}
                            <ActivityTimestamp
                                date={event.created_at}
                                {timeZone} />
                        {:else}
                            <span class="flex items-center justify-end gap-1">
                                <Button
                                    size="xs"
                                    type="ghost"
                                    disabled={busy || inbox.isMutating}
                                    onclick={() => openEvent(entry)}>
                                    Details
                                    {#snippet trailing()}<ChevronRight class="size-2" />{/snippet}
                                </Button>
                                <ActionMenu
                                    ariaLabel={`Actions for ${activitySentence(event)}`}
                                    disabled={busy || inbox.isMutating}
                                    items={[
                                        {
                                            label:
                                                event.pinned_at ? 'Unpin notification' : (
                                                    'Pin notification'
                                                ),
                                            icon: event.pinned_at ? PinOff : Pin,
                                            onSelect: () => pinEvent(entry, !event.pinned_at)
                                        },
                                        {
                                            label: 'Mark as read',
                                            icon: Check,
                                            disabled: Boolean(event.read_at),
                                            onSelect: () => readEvent(entry)
                                        },
                                        {
                                            label: 'Delete notification',
                                            icon: Trash,
                                            danger: true,
                                            onSelect: () => deleteEvent(entry.id)
                                        }
                                    ]} />
                            </span>
                        {/if}
                    {/snippet}
                </DataTable>
            {:else}
                <DataTable
                    title={`All ${title.toLowerCase()}`}
                    meta={showListControls ? listCount : undefined}
                    toolbar={showListControls ? listToolbar : undefined}
                    state={listBlocked ? listStateView : undefined}
                    footer={listBlocked ? undefined : listPagination}
                    caption={title}
                    columns={listColumns}
                    data={rows as unknown as Record<string, unknown>[]}
                    onRowSelect={row => open(row as unknown as WorkspaceRow)}>
                    {#snippet cell(row, key)}
                        {@const item = row as unknown as WorkspaceRow}
                        {#if key === 'page'}
                            <span title={item.title}>{item.title}</span>
                        {:else if key === 'author'}
                            {item.author}
                        {:else if key === 'reason'}
                            <span title={reportReasonLabel(item.reason ?? '')}
                                >{reportReasonLabel(item.reason ?? '')}</span>
                        {:else if key === 'score'}
                            {majorityPercent(item.helpful ?? 0, item.unhelpful ?? 0)}
                        {:else if key === 'total'}
                            {formatCount(item.total)}
                        {:else if key === 'latest'}
                            <span class="whitespace-nowrap">{date(item.latest)}</span>
                        {:else}
                            <Button
                                size="xs"
                                type="ghost"
                                onclick={() => open(item)}>
                                Details
                                {#snippet trailing()}<ChevronRight class="size-2" />{/snippet}
                            </Button>
                        {/if}
                    {/snippet}
                </DataTable>
            {/if}
        </div>
        {#if selected}
            <div
                id="workspace-detail"
                tabindex="-1"
                class="flex min-w-0 flex-col gap-4 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <Button
                        size="sm"
                        type="outline"
                        onclick={() => navigate({ selected: null, detailPage: null, focus: null })}>
                        {#snippet leading()}<ArrowLeft class="size-3.5 shrink-0" />{/snippet}
                        Back to {title.toLowerCase()}
                    </Button>
                </div>
                {#if detail.error}<ErrorState
                        title="Unable to load details"
                        description={detail.error}
                        onRetry={() => detail.load(options(true), true)} />{/if}
                {#if detail.loading && !detail.data}<LoadingState label="Loading details…" />
                {:else if detail.data}
                    {#if detail.data.savedNotification?.report_status === 'resolved'}
                        <Card density="compact"
                            ><h2 class="mb-2 type-card-title">Resolved report · Saved context</h2>
                            <ActivityRow
                                item={detail.data.savedNotification}
                                detail />
                            <p
                                class="mt-2 type-body wrap-break-word whitespace-pre-wrap text-text-secondary">
                                {detail.data.savedNotification.meta?.comment}
                            </p>
                            <p
                                class="mt-2 type-body wrap-break-word whitespace-pre-wrap text-text-secondary">
                                {detail.data.savedNotification.meta?.details}
                            </p></Card>
                    {/if}
                    {#if area === 'reports' && detail.data.context}
                        {@const commenter = detail.data.context.author || 'Anonymous'}
                        <Card density="compact">
                            <div class="flex items-start gap-2.5 sm:gap-3">
                                <Avatar
                                    name={commenter}
                                    class="size-6.5 sm:size-7" />
                                <div class="min-w-0 flex-1">
                                    <div
                                        class="inline-block max-w-full rounded-md border border-border-subtle bg-surface-card px-2 py-1 text-left">
                                        <div class="flex min-h-6.5 items-center">
                                            <span
                                                class="truncate text-xs leading-none font-semibold text-text-primary"
                                                >{commenter}</span>
                                        </div>
                                        <div
                                            class="mt-0.5 type-body wrap-break-word whitespace-pre-wrap text-text-secondary">
                                            {detail.data.context.content}
                                        </div>
                                    </div>
                                    <div
                                        class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-secondary">
                                        <span class="inline-flex items-center gap-1">
                                            <Flag
                                                class="size-3 text-text-muted"
                                                aria-hidden="true" />{pluralize(
                                                detail.data.context.total,
                                                'report',
                                                undefined,
                                                formatCount
                                            )}</span>
                                        {#if detail.data.context.commentedAt}
                                            <span class="inline-flex items-center gap-1"
                                                ><Calendar
                                                    class="size-3 text-text-muted"
                                                    aria-hidden="true" />
                                                {date(detail.data.context.commentedAt)}</span>
                                        {/if}
                                        <span class="inline-flex items-center gap-1"
                                            ><Hash
                                                class="size-3 text-text-muted"
                                                aria-hidden="true" />
                                            {detail.data.context.id}</span>
                                    </div>
                                </div>
                            </div></Card>
                    {:else if area === 'feedback'}
                        <Card density="compact">
                            <CategoryTrendChart
                                title={detail.data.context?.title
                                    ?? detail.data.items[0]?.title
                                    ?? (detailTitle || 'Page feedback')}
                                description="Helpful vs. unhelpful responses for this page."
                                data={detailChartRows}
                                series={chartSeries}
                                {timeZone}
                                isLoading={detailAnalyticsLoading}
                                error={detailAnalyticsError}
                                range={trendRange}
                                onRangeChange={setChartRange}
                                onRetry={loadDetailAnalytics}
                                allowDonut />
                        </Card>

                        {@render eventsHistory()}
                    {:else if area === 'notifications'}
                        <Card density="compact"
                            ><h2 class="type-card-title">
                                {detail.data.items[0]?.title
                                    ?? (detailTitle || 'Notification group')}
                            </h2>
                            <p class="mt-2 type-body text-text-secondary">
                                {pluralize(
                                    detail.data.total ?? groupCount ?? 0,
                                    'event',
                                    undefined,
                                    formatCount
                                )} in this group
                            </p>
                            <div class="mt-3 flex flex-wrap gap-2">
                                <Button
                                    size="sm"
                                    disabled={busy}
                                    onclick={() => groupAction()}>Mark group as read</Button
                                ><Button
                                    size="sm"
                                    type="ghost"
                                    disabled={busy}
                                    onclick={() => {
                                        preparedGroup = {
                                            id: selected,
                                            asOf: detail.data!.asOf,
                                            timeZone,
                                            count: detail.data!.total ?? groupCount ?? 0
                                        };
                                        confirmation = 'group';
                                    }}>Delete group</Button>
                            </div></Card>
                    {/if}
                    {#if area !== 'feedback'}{@render eventsHistory()}{/if}
                {/if}
            </div>
        {/if}
    </div>
</Section>

{#snippet notificationActions()}
    <span class="ml-auto text-xs leading-5 text-text-muted"
        >{pluralize(inbox.unreadCount, 'unread notification', undefined, formatCount)}</span>
    <Button
        size="xs"
        type="ghost"
        disabled={busy || inbox.isMutating || !inbox.unreadCount}
        onclick={async () => {
            if (await inbox.markAllRead()) {
                if (list.data)
                    list.data = {
                        ...list.data,
                        items: list.data.items.map(row => ({
                            ...row,
                            event:
                                row.event ?
                                    {
                                        ...row.event,
                                        read_at: row.event.read_at ?? new Date().toISOString()
                                    }
                                :   undefined
                        }))
                    };
                await refresh();
            }
        }}>
        {#snippet leading()}<CheckCheck class="size-3" />{/snippet}
        Mark all as read
    </Button>
    <Button
        size="xs"
        type="ghost"
        disabled={busy || inbox.isMutating || !readCount}
        onclick={prepareClear}>
        {#snippet leading()}<Trash class="size-3" />{/snippet}
        Clear all read
    </Button>
{/snippet}

{#snippet eventsHistory()}
    {#if detail.data}
        {#if params.has('focus') && area !== 'reports'}<Button
                size="sm"
                type="outline"
                onclick={() => updateDetail({})}>Showing one event · Show all</Button
            >{/if}
        {@const empty = !detail.data.items.length}
        {#if area === 'notifications'}
            <DataTable
                title={historyTitle}
                state={empty ? historyEmpty : undefined}
                footer={empty ? undefined : detailPagination}
                caption={`${title} history`}
                columns={historyColumns}
                data={historyRows}
                rowClass={row =>
                    (row as unknown as WorkspaceRow).event?.read_at ?
                        ''
                    :   'bg-notification-unread hover:bg-notification-unread-hover'}
                onRowSelect={row => openHistoryEvent(row as unknown as WorkspaceRow)}>
                {#snippet cell(row, key)}
                    {@const entry = row as unknown as WorkspaceRow}
                    {@const event = entry.event as AdminNotificationRow}
                    {#if key === 'activity'}
                        <ActivityBadge
                            kind={event.kind}
                            vote={event.meta?.vote} />
                    {:else if key === 'page'}
                        <ActivityPageLink item={event} />
                    {:else if key === 'details'}
                        <span class="flex min-w-0 flex-col gap-1">
                            <ActivityDetails
                                item={event}
                                withAuthor />
                            {#if event.meta?.comment || event.meta?.details}
                                <details>
                                    <summary class="cursor-pointer text-accent-text"
                                        >View saved context</summary>
                                    {#if event.meta.comment}<span
                                            class="mt-1 block wrap-break-word whitespace-pre-wrap"
                                            >{event.meta.comment}</span
                                        >{/if}
                                    {#if event.meta.details}<span
                                            class="mt-1 block wrap-break-word whitespace-pre-wrap text-text-muted"
                                            >{event.meta.details}</span
                                        >{/if}
                                </details>
                            {/if}
                        </span>
                    {:else if key === 'time'}
                        <ActivityTimestamp
                            date={event.created_at}
                            {timeZone} />
                    {:else}
                        <span class="flex items-center justify-end gap-1">
                            <Button
                                size="xs"
                                type="ghost"
                                disabled={busy || inbox.isMutating}
                                onclick={() => openHistoryEvent(entry)}>
                                Details
                                {#snippet trailing()}<ChevronRight class="size-2" />{/snippet}
                            </Button>
                            <ActionMenu
                                ariaLabel={`Actions for ${activitySentence(event)}`}
                                disabled={busy || inbox.isMutating}
                                items={[
                                    {
                                        label:
                                            event.pinned_at ? 'Unpin notification' : (
                                                'Pin notification'
                                            ),
                                        icon: event.pinned_at ? PinOff : Pin,
                                        onSelect: () => pinEvent(entry, !event.pinned_at)
                                    },
                                    {
                                        label: 'Mark as read',
                                        icon: Check,
                                        disabled: Boolean(event.read_at),
                                        onSelect: () => readEvent(entry)
                                    },
                                    {
                                        label: 'Delete notification',
                                        icon: Trash,
                                        danger: true,
                                        onSelect: () => deleteEvent(entry.id)
                                    }
                                ]} />
                        </span>
                    {/if}
                {/snippet}
            </DataTable>
        {:else}
            <DataTable
                title={historyTitle}
                meta={showDetailControls ?
                    area === 'reports' ?
                        reportsCount
                    :   feedbackCount
                :   undefined}
                toolbar={showDetailControls ?
                    area === 'reports' ?
                        reportsToolbar
                    :   feedbackToolbar
                :   undefined}
                state={empty ? historyEmpty : undefined}
                footer={empty ? undefined : detailPagination}
                caption={`${title} history`}
                columns={historyColumns}
                rowClass={row =>
                    (row as unknown as WorkspaceRow).id === params.get('focus') ?
                        'bg-accent-subtle'
                    :   ''}
                data={detail.data.items as unknown as Record<string, unknown>[]}>
                {#snippet cell(row, key)}
                    {@const item = row as unknown as WorkspaceRow}
                    {#if key === 'reason'}
                        <Badge
                            variant="custom"
                            color={reportReasonColor(item.reason ?? '')}
                            class="whitespace-nowrap">
                            {reportReasonLabel(item.reason ?? '')}
                        </Badge>
                    {:else if key === 'response'}
                        <ActivityBadge
                            kind="helpful"
                            vote={item.vote === 'yes' ? 'yes' : 'no'} />
                    {:else if key === 'details'}
                        <span
                            title={item.details || undefined}
                            class={item.details ? undefined : 'text-text-muted italic'}
                            >{item.details || 'No additional details provided.'}</span>
                    {:else}
                        <span class="whitespace-nowrap">{date(item.latest)}</span>
                    {/if}
                {/snippet}
            </DataTable>
        {/if}
    {/if}
{/snippet}

{#snippet listToolbar()}
    <FilterToolbar
        embedded
        title={`${title} filters`}>
        {#snippet searchSlot()}
            <Input
                type="search"
                aria-label={`Search ${title.toLowerCase()}`}
                placeholder={area === 'reports' ? 'Search comments, authors, or articles…'
                : area === 'feedback' ? 'Search page titles…'
                : 'Search notifications…'}
                value={search}
                oninput={event => {
                    search = event.currentTarget.value;
                    clearTimeout(debounce);
                    debounce = setTimeout(() => filter({ query: search }), 300);
                }} />
        {/snippet}
        {#snippet filterControlsSlot()}
            {#if area === 'reports'}
                <Dropdown
                    label="Category"
                    value={params.get('reason') ?? ''}
                    options={[
                        { value: '', label: 'All' },
                        ...REPORT_REASONS.map(r => ({ value: r.id, label: r.label }))
                    ]}
                    onChange={reason => filter({ reason })} />
            {:else if area === 'feedback'}
                <Dropdown
                    label="Page"
                    value={params.get('type') ?? 'all'}
                    options={[
                        { value: 'all', label: 'All' },
                        { value: 'article', label: 'Articles' },
                        { value: 'legal', label: 'Legal pages' }
                    ]}
                    onChange={type => filter({ type })} />
            {:else}
                <Dropdown
                    label="Category"
                    value={params.get('type') ?? 'all'}
                    options={notificationTypes}
                    onChange={type => filter({ type })} />
                <Dropdown
                    label="Status"
                    value={params.get('read') ?? 'all'}
                    options={[
                        { value: 'all', label: 'All' },
                        { value: 'unread', label: 'Unread' },
                        { value: 'read', label: 'Read' }
                    ]}
                    onChange={read => filter({ read })} />
            {/if}
        {/snippet}
        {#snippet sortSlot()}
            <SortControl
                labelPrefix="Sort by"
                fields={sortFields}
                currentField={params.get('sort') ?? 'date'}
                currentDirection={params.get('direction') === 'asc' ? 'asc' : 'desc'}
                onFieldChange={sort => filter({ sort })}
                onDirectionToggle={() =>
                    filter({ direction: params.get('direction') === 'asc' ? 'desc' : 'asc' })} />
        {/snippet}
    </FilterToolbar>
{/snippet}

{#snippet listCount()}
    {#if list.loading || (list.data?.total ?? 0) > 0}
        <SearchResultCount
            count={list.data?.items.length ?? 0}
            total={list.data?.total ?? 0}
            loading={list.loading}
            itemLabel={area === 'reports' ? 'reported comments'
            : area === 'feedback' ? 'pages'
            : 'notifications'} />
    {/if}
{/snippet}

{#snippet reportsToolbar()}
    <FilterToolbar
        embedded
        title="Report details filters">
        {#snippet searchSlot()}
            <Input
                type="search"
                size="sm"
                aria-label="Search report details"
                placeholder="Search report details…"
                value={detailSearch}
                oninput={event => {
                    detailSearch = event.currentTarget.value;
                    clearTimeout(detailDebounce);
                    detailDebounce = setTimeout(
                        () => updateDetail({ detailQuery: detailSearch }),
                        300
                    );
                }} />
        {/snippet}
        {#snippet filterControlsSlot()}
            <Dropdown
                label="Category"
                value={params.get('detailReason') ?? ''}
                options={[
                    { value: '', label: 'All' },
                    ...REPORT_REASONS.map(r => ({ value: r.id, label: r.label }))
                ]}
                onChange={detailReason => updateDetail({ detailReason })} />
        {/snippet}

        {#snippet sortSlot()}
            <SortControl
                fields={[
                    { value: 'date', label: 'Date' },
                    { value: 'reason', label: 'Reason' },
                    { value: 'details', label: 'Details' }
                ]}
                currentField={params.get('detailSort') ?? 'date'}
                onFieldChange={detailSort => updateDetail({ detailSort })}
                currentDirection={params.get('detailDirection') === 'asc' ? 'asc' : 'desc'}
                onDirectionToggle={() =>
                    updateDetail({
                        detailDirection: params.get('detailDirection') === 'asc' ? 'desc' : 'asc'
                    })} />
        {/snippet}
    </FilterToolbar>
{/snippet}

{#snippet reportsCount()}
    {#if detail.loading || (detail.data?.total ?? 0) > 0}
        <SearchResultCount
            count={detail.data?.items.length ?? 0}
            total={detail.data?.total ?? 0}
            loading={detail.loading}
            itemLabel="reports" />
    {/if}
{/snippet}

{#snippet feedbackToolbar()}
    <FilterToolbar
        embedded
        title="Response filter">
        {#snippet filterControlsSlot()}
            <Dropdown
                label="Response"
                value={params.get('vote') ?? 'all'}
                options={[
                    { value: 'all', label: 'All' },
                    { value: 'yes', label: 'Helpful' },
                    { value: 'no', label: 'Unhelpful' }
                ]}
                onChange={vote => updateDetail({ vote })} />
        {/snippet}

        {#snippet sortSlot()}
            <SortControl
                fields={[
                    { value: 'date', label: 'Date' },
                    { value: 'response', label: 'Response' }
                ]}
                currentField={params.get('detailSort') ?? 'date'}
                onFieldChange={detailSort => updateDetail({ detailSort })}
                currentDirection={params.get('detailDirection') === 'asc' ? 'asc' : 'desc'}
                onDirectionToggle={() =>
                    updateDetail({
                        detailDirection: params.get('detailDirection') === 'asc' ? 'desc' : 'asc'
                    })} />
        {/snippet}
    </FilterToolbar>
{/snippet}

{#snippet feedbackCount()}
    {#if detail.loading || (detail.data?.total ?? 0) > 0}
        <SearchResultCount
            count={detail.data?.items.length ?? 0}
            total={detail.data?.total ?? 0}
            loading={detail.loading}
            itemLabel="events" />
    {/if}
{/snippet}

{#snippet listStateView()}
    {#if list.loading && !list.data}
        <LoadingState label="Loading results…" />
    {:else}
        <EmptyState
            title={listFiltersActive ? 'No matching activity' : `No ${area} yet`}
            description={listFiltersActive ?
                'Try another period or filter.'
            :   'Activity will appear here when it becomes available.'} />
    {/if}
{/snippet}

{#snippet historyEmpty()}
    <EmptyState
        title={detailFiltersActive ? 'No matching activity' : 'Nothing here'}
        description={detailFiltersActive ? 'Try another filter.' : (
            'It may have been resolved, removed, or fall outside the selected period.'
        )} />
{/snippet}

{#snippet listPagination()}{@render pagination(false)}{/snippet}

{#snippet detailPagination()}{@render pagination(true)}{/snippet}

{#snippet pagination(isDetail: boolean)}
    {@const feed = isDetail ? detail : list}
    {@const total = feed.data?.total ?? 0}
    {@const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))}
    {#if feed.data}
        <Pagination
            page={Number(params.get(isDetail ? 'detailPage' : 'page') ?? '1')}
            {totalPages}
            onPageChange={page => goToPage(isDetail, page)}
            size="sm" />
    {/if}
{/snippet}

<ConfirmationDialog
    isOpen={confirmation !== null}
    title={confirmation === 'all' ? 'Clear read notifications?' : 'Delete this notification group?'}
    message={confirmation === 'all' ?
        `Delete ${pluralize(clearOperation?.count ?? 0, 'read notification', undefined, formatCount)}? Unread notifications stay, and reports and feedback remain saved.`
    :   `Delete ${pluralize(preparedGroup?.count ?? 0, 'event', undefined, formatCount)} in this group? Reports and feedback remain saved.`}
    confirmLabel={confirmation === 'all' ? 'Clear read' : 'Delete group'}
    isDestructive
    isLoading={busy}
    onConfirm={confirmDelete}
    onCancel={() => {
        confirmation = null;
        preparedGroup = null;
        clearOperation = null;
        actionError = '';
    }}>
    {#if actionError}<FieldMessage
            variant="error"
            message={actionError} />{/if}
</ConfirmationDialog>
