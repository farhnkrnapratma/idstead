<script lang="ts">
    import { stableHeight } from '@idstead/ui/utils/stableHeight.ts';
    import { adminUrl, navigateAdmin } from '../../adminNavigation.ts';
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { publicHref, publicSiteUrl } from '#app/publicSite.ts';
    import { analyticsPeriod, browserTimeZone, zonedMidnight } from '../../adminAnalytics.ts';
    import {
        ArrowRight,
        ArrowUpRight,
        CalendarCheck2,
        Eye,
        Flag,
        Mail,
        ThumbsUp,
        Users
    } from '@lucide/svelte';
    import { adminActivityRequest } from '../../adminActivityClient.ts';
    import { adminNotificationsStore } from '../../stores/adminNotificationsStore.svelte.ts';
    import { adminChartRangeStore } from '../../stores/adminChartRangeStore.svelte.ts';
    import { WorkspaceFeed } from '../../stores/workspaceFeed.svelte.ts';
    import { pluralize } from '@idstead/domain/pluralize.ts';
    import {
        formatCount,
        helpfulPercent,
        majorityPercent,
        type WorkspaceCalendar,
        type WorkspaceOverview,
        type WorkspaceArea,
        type WorkspaceRow
    } from '#lib/adminWorkspace.ts';
    import type { SubscriberStats } from '@idstead/data';
    import Card from '@idstead/ui/components/Card.svelte';
    import StatsGrid from '@idstead/ui/components/StatsGrid.svelte';
    import Button from '@idstead/ui/components/Button.svelte';
    import { reportReasonLabel } from '#lib/reportReasons.ts';
    import DataTable, { type DataTableColumn } from '@idstead/ui/components/DataTable.svelte';
    import ActivityTimestamp from './ActivityTimestamp.svelte';
    import ErrorState from '@idstead/ui/components/ErrorState.svelte';
    import LoadingState from '@idstead/ui/components/LoadingState.svelte';
    import EmptyState from '@idstead/ui/components/EmptyState.svelte';
    import Section from '@idstead/ui/layout/Section.svelte';
    import ViewsCalendar from './ViewsCalendar.svelte';
    import ViewsChart from './ViewsChart.svelte';
    import type { ViewsRange } from '#lib/components/admin/viewsRange.ts';

    const siteUrl = $derived(publicSiteUrl(page.data));
    let {
        onNavigate,
        onPublished
    }: { onNavigate: (area: WorkspaceArea, id?: string) => void; onPublished: () => void } =
        $props();
    let data = $state.raw<WorkspaceOverview | null>(null);
    let calendar = $state.raw<WorkspaceCalendar | null>(null);
    let calendarError = $state('');
    let error = $state('');
    let loading = $state(true);
    let controller: AbortController | undefined;
    let autoRefresh: ReturnType<typeof setTimeout> | undefined;
    let generation = 0;
    const reportsFeed = new WorkspaceFeed();
    const feedbackFeed = new WorkspaceFeed();
    const params = $derived(adminUrl().searchParams);
    const timeZone = browserTimeZone();
    function period(values: Record<string, string>) {
        const url = adminUrl();
        for (const [key, value] of Object.entries(values))
            if (value) url.searchParams.set(key, value);
            else url.searchParams.delete(key);
        navigateAdmin(url, true);
    }
    function refresh() {
        void load();
        loadLists(true);
    }
    const range = $derived(adminChartRangeStore.current);
    function setRange(next: ViewsRange) {
        adminChartRangeStore.set(next);
        void load();
    }
    const calendarYear = $derived(Number(params.get('calendarYear')) || new Date().getFullYear());
    function setCalendarYear(year: number) {
        period({ calendarYear: year === new Date().getFullYear() ? '' : String(year) });
    }
    function loadLists(refresh = false) {
        void reportsFeed.load({ section: 'reports', timeZone, preview: 'true' }, refresh);
        const feedbackPeriod = analyticsPeriod('1y', timeZone, new Date());
        void feedbackFeed.load(
            {
                section: 'feedback',
                timeZone,
                from: feedbackPeriod.from,
                to: feedbackPeriod.to,
                preview: 'true'
            },
            refresh
        );
    }
    const reportColumns: DataTableColumn[] = [
        { key: 'page', header: 'Page', width: '30%' },
        { key: 'author', header: 'Author', width: '20%' },
        { key: 'reason', header: 'Reason', width: '22%' },
        { key: 'total', header: 'Reports', align: 'right', width: '8%' },
        { key: 'latest', header: 'Last activity', width: '20%' }
    ];
    const feedbackColumns: DataTableColumn[] = [
        { key: 'page', header: 'Page', width: '30%' },
        { key: 'score', header: 'Score', width: '20%' },
        { key: 'total', header: 'Responses', align: 'right', width: '30%' },
        { key: 'latest', header: 'Last activity', width: '20%' }
    ];
    const overviewLists = $derived([
        {
            area: 'reports' as const,
            title: 'Reported comments',
            empty: 'No reports',
            emptyIcon: Flag,
            emptyDescription: 'Comments readers report will appear here.',
            feed: reportsFeed
        },
        {
            area: 'feedback' as const,
            title: 'User feedback',
            empty: 'No feedback yet',
            emptyIcon: Users,
            emptyDescription: 'Feedback sent from the site will appear here.',
            feed: feedbackFeed
        }
    ]);
    let subscribers = $state<SubscriberStats | null>(null);

    async function loadSubscribers() {
        try {
            subscribers = await adminActivityRequest<SubscriberStats>('activity', {
                section: 'subscribers'
            });
        } catch {}
    }

    async function load() {
        const current = ++generation;
        const query: Record<string, string> = analyticsPeriod(
            adminChartRangeStore.current,
            timeZone,
            new Date()
        );
        controller?.abort();
        controller = new AbortController();
        loading = true;
        try {
            const [overviewResult, calendarResult] = await Promise.allSettled([
                adminActivityRequest<WorkspaceOverview>(
                    'workspace',
                    { ...query, section: 'overview' },
                    undefined,
                    controller.signal
                ),
                adminActivityRequest<WorkspaceCalendar>(
                    'workspace',
                    {
                        section: 'calendar',
                        timeZone,
                        ...(calendarYear === new Date().getFullYear() ?
                            {}
                        :   {
                                asOf: new Date(
                                    Date.parse(zonedMidnight(`${calendarYear + 1}-01-01`, timeZone))
                                        - 1000
                                ).toISOString()
                            })
                    },
                    undefined,
                    controller.signal
                )
            ]);
            if (current === generation) {
                if (overviewResult.status === 'fulfilled') {
                    data = overviewResult.value;
                    error = '';
                } else
                    error =
                        overviewResult.reason instanceof Error ?
                            overviewResult.reason.message
                        :   'Dashboard could not be loaded.';
                if (calendarResult.status === 'fulfilled') {
                    calendar = calendarResult.value;
                    calendarError = '';
                } else
                    calendarError =
                        calendarResult.reason instanceof Error ?
                            calendarResult.reason.message
                        :   'Calendar could not be loaded.';
            }
        } catch (caught) {
            if (current === generation && !controller.signal.aborted)
                error = caught instanceof Error ? caught.message : 'Dashboard could not be loaded.';
        } finally {
            if (current === generation) loading = false;
        }
    }
    const stats = $derived([
        {
            label: 'Article views',
            value: data ? formatCount(data.allTimeReads) : '—',
            componentIcon: Eye,
            onclick: () => document.getElementById('admin-readers')?.focus()
        },
        {
            label: 'Open reports',
            value: data ? formatCount(data.openReports) : '—',
            description:
                data ?
                    pluralize(data.reportedComments, 'comment', undefined, formatCount)
                :   'Comments',
            componentIcon: Flag,
            onclick: () => onNavigate('reports')
        },
        {
            label: 'Helpful',
            value: data ? helpfulPercent(data.allTimeHelpful, data.allTimeUnhelpful) : '—',
            description:
                data ?
                    pluralize(
                        data.allTimeHelpful + data.allTimeUnhelpful,
                        'response',
                        undefined,
                        formatCount
                    )
                :   'Responses',
            ratio:
                data && data.allTimeHelpful + data.allTimeUnhelpful > 0 ?
                    data.allTimeHelpful / (data.allTimeHelpful + data.allTimeUnhelpful)
                :   undefined,
            componentIcon: ThumbsUp,
            onclick: () => onNavigate('feedback')
        },
        {
            label: 'Published',
            value: data ? formatCount(data.published) : '—',
            description:
                data ? `of ${pluralize(data.posts, 'post', undefined, formatCount)}` : 'Posts',
            ratio: data && data.posts > 0 ? data.published / data.posts : undefined,
            componentIcon: CalendarCheck2,
            onclick: onPublished
        },
        {
            label: pluralize(subscribers?.active ?? 0, 'Subscriber', undefined, () => '').trim(),
            value: data && subscribers ? formatCount(subscribers.active) : '—',
            description:
                data && subscribers ?
                    `${formatCount(subscribers.pending)} awaiting confirmation`
                :   'Email list',
            componentIcon: Mail
        }
    ]);
    onMount(() => {
        adminChartRangeStore.init();
        void loadSubscribers();
        loadLists();
        const remove = adminNotificationsStore.onActivityRefresh(async () => {
            clearTimeout(autoRefresh);
            autoRefresh = setTimeout(refresh, 1000);
        });
        return () => {
            clearTimeout(autoRefresh);
            generation++;
            controller?.abort();
            remove();
        };
    });
</script>

{#snippet pageStatsEmpty()}
    <EmptyState
        icon={Eye}
        title="No page statistics yet"
        description="Page views will appear here once your pages receive visits." />
{/snippet}

<Section
    spacing="none"
    class="flex min-w-0 flex-col gap-4">
    <div
        {@attach () => {
            params.toString();
            void load();
            loadLists();
        }}>
        <h1 class="type-page-title">Overview</h1>
        <p class="mt-1 type-body text-fg-secondary">Your site activity at a glance.</p>
    </div>
    {#if error}<ErrorState
            title="Unable to update overview"
            description={error}
            onRetry={load} />{/if}
    <StatsGrid
        {stats}
        variant="compact"
        columns={5} />
    <Card density="compact">
        {#if calendarError}<ErrorState
                title="Unable to load calendar"
                description={calendarError}
                onRetry={load} />
        {:else if calendar && calendar.timeZone === timeZone && calendar.year === calendarYear}<ViewsCalendar
                data={calendar}
                onPrevYear={() => setCalendarYear(calendarYear - 1)}
                onNextYear={() => setCalendarYear(calendarYear + 1)}
                canGoNext={calendarYear < new Date().getFullYear()} />
        {:else}<LoadingState label="Loading calendar…" />{/if}
    </Card>
    <Card
        id="admin-readers"
        tabindex={-1}
        density="compact"
        class="scroll-mt-20 focus-visible:outline-2 focus-visible:outline-focus-ring">
        {#if loading && !data}<LoadingState label="Loading analytics…" />
        {:else if data}<ViewsChart
                data={data.series}
                timeZone={data.timeZone}
                {range}
                onRangeChange={setRange} />
        {:else}<ErrorState
                title="Readers chart unavailable"
                description="The overview could not be loaded."
                onRetry={load} />{/if}
    </Card>
    {#if data}
        <DataTable
            title="Page statistics"
            caption="Page statistics"
            state={data.topPages.length ? undefined : pageStatsEmpty}
            columns={[
                { key: 'metric', header: 'Metric', width: '30%' },
                { key: 'page', header: 'Page', width: '32%' },
                {
                    key: 'view',
                    header: '',
                    srHeader: 'Views',
                    width: '22%',
                    class: 'overflow-visible'
                },
                { key: 'value', header: 'Value', align: 'right', width: '16%' }
            ]}
            data={data.topPages as unknown as Record<string, unknown>[]}>
            {#snippet cell(row, key)}
                {#if key === 'metric'}
                    <span class="whitespace-nowrap">{row.metric}</span>
                {:else if key === 'view'}
                    {#if row.href}
                        <Button
                            type="ghost"
                            size="xs"
                            href={publicHref(siteUrl, String(row.href))}
                            target="_blank"
                            rel="noopener noreferrer">
                            View {String(row.href).startsWith('/blog/') ? 'article' : 'page'}
                            {#snippet trailing()}
                                <ArrowUpRight
                                    strokeWidth={1.5}
                                    class="size-3" />
                            {/snippet}
                        </Button>
                    {/if}
                {:else if key === 'value'}
                    <span>{row.value}</span>
                {:else}
                    {row[key] ?? '—'}
                {/if}
            {/snippet}
        </DataTable>
    {/if}
    <div class="grid min-w-0 gap-4">
        {#each overviewLists as { area, title, empty, emptyIcon, emptyDescription, feed } (area)}
            {#snippet viewAll()}
                <Button
                    type="ghost"
                    size="sm"
                    onclick={() => onNavigate(area)}>
                    View all
                    {#snippet trailing()}<ArrowRight class="size-3" />{/snippet}
                </Button>
            {/snippet}
            {#snippet listState()}
                <div {@attach stableHeight}>
                    {#if feed.loading && !feed.data}
                        <LoadingState label="Loading activity…" />
                    {:else if feed.error}
                        <ErrorState
                            description={feed.error}
                            size="inline"
                            onRetry={() => loadLists(true)} />
                    {:else}
                        <EmptyState
                            icon={emptyIcon}
                            title={empty}
                            description={emptyDescription} />
                    {/if}
                </div>
            {/snippet}
            <div class="min-w-0">
                {#if (feed.loading && !feed.data) || feed.error || !feed.data?.items.length}
                    <DataTable
                        caption={title}
                        {title}
                        state={listState}
                        columns={area === 'reports' ? reportColumns : feedbackColumns}
                        data={[]} />
                {:else}
                    <DataTable
                        caption={title}
                        {title}
                        columns={area === 'reports' ? reportColumns : feedbackColumns}
                        data={feed.data.items as unknown as Record<string, unknown>[]}
                        onRowSelect={row => onNavigate(area, String(row.id))}>
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
                                <span class="whitespace-nowrap">{formatCount(item.total)}</span>
                            {:else}
                                <ActivityTimestamp
                                    date={item.latest}
                                    {timeZone} />
                            {/if}
                        {/snippet}
                    </DataTable>
                    <div class="mt-3 flex justify-end">{@render viewAll()}</div>
                {/if}
            </div>
        {/each}
    </div>
</Section>
