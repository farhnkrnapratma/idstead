<script lang="ts">
  import {adminUrl, navigateAdmin} from '$lib/adminNavigation';
  import {onMount} from 'svelte';
  import {analyticsPeriod} from '$lib/adminAnalytics';
  import {Eye, Flag, ThumbsUp, CalendarCheck2} from '@lucide/svelte';
  import {adminActivityRequest} from '$lib/adminActivityClient';
  import {adminNotificationsStore} from '$lib/stores/adminNotificationsStore.svelte';
  import {
    formatCount,
    helpfulPercent,
    type WorkspaceCalendar,
    type WorkspaceOverview,
    type WorkspaceArea
  } from '$lib/adminWorkspace';
  import Card from '../Card.svelte';
  import StatsGrid from '../StatsGrid.svelte';
  import Button from '../Button.svelte';
  import {activityTimestamp} from '$lib/adminActivity';
  import ErrorState from '../ErrorState.svelte';
  import LoadingState from '../LoadingState.svelte';
  import EmptyState from '../EmptyState.svelte';
  import Section from '$lib/layout/Section.svelte';
  import ViewsCalendar from './ViewsCalendar.svelte';
  import ViewsChart from './ViewsChart.svelte';
  import AnalyticsPeriod from './AnalyticsPeriod.svelte';
  let {
    onNavigate,
    onPublished
  }: {
    onNavigate: (area: WorkspaceArea, id?: string) => void;
    onPublished: () => void;
  } = $props();
  let data = $state.raw<WorkspaceOverview | null>(null);
  let calendar = $state.raw<WorkspaceCalendar | null>(null);
  let calendarError = $state('');
  let error = $state('');
  let loading = $state(true);
  let controller: AbortController | undefined;
  let autoRefresh: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  const params = $derived(adminUrl().searchParams);
  function period(values: Record<string, string>) {
    const url = adminUrl();
    for (const [key, value] of Object.entries(values))
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    navigateAdmin(url, true);
  }
  function refresh() {
    try {
      period(
        analyticsPeriod(
          params.get('range') ?? '7d',
          params.get('timeZone') ?? 'UTC',
          new Date(),
          params.get('start') ?? undefined,
          params.get('end') ?? undefined
        )
      );
    } catch (caught) {
      error =
        caught instanceof Error ? caught.message : 'Choose a valid period.';
    }
  }
  async function load() {
    const current = ++generation;
    const query = Object.fromEntries(params);
    if (!query.timeZone) return;
    controller?.abort();
    controller = new AbortController();
    loading = true;
    try {
      const [overviewResult, calendarResult] = await Promise.allSettled([
        adminActivityRequest<WorkspaceOverview>(
          'workspace',
          {...query, section: 'overview'},
          undefined,
          controller.signal
        ),
        adminActivityRequest<WorkspaceCalendar>(
          'workspace',
          {section: 'calendar', timeZone: query.timeZone},
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
            : 'Dashboard could not be loaded.';
        if (calendarResult.status === 'fulfilled') {
          calendar = calendarResult.value;
          calendarError = '';
        } else
          calendarError =
            calendarResult.reason instanceof Error ?
              calendarResult.reason.message
            : 'Calendar could not be loaded.';
      }
    } catch (caught) {
      if (current === generation && !controller.signal.aborted)
        error =
          caught instanceof Error ?
            caught.message
          : 'Dashboard could not be loaded.';
    } finally {
      if (current === generation) loading = false;
    }
  }
  const stats = $derived([
    {
      label: 'Article views',
      value: data ? formatCount(data.reads) : '—',
      description: 'In the selected period',
      componentIcon: Eye,
      onclick: () => document.getElementById('admin-readers')?.focus()
    },
    {
      label: 'Open reports',
      value: data ? formatCount(data.openReports) : '—',
      description:
        data ? `${formatCount(data.reportedComments)} comments` : 'Comments',
      componentIcon: Flag,
      onclick: () => onNavigate('reports')
    },
    {
      label: 'Helpful',
      value: data ? helpfulPercent(data.helpful, data.unhelpful) : '—',
      description:
        data ?
          `${formatCount(data.helpful + data.unhelpful)} responses`
        : 'Responses',
      componentIcon: ThumbsUp,
      onclick: () => onNavigate('feedback')
    },
    {
      label: 'Published',
      value: data ? formatCount(data.published) : '—',
      description: data ? `of ${formatCount(data.posts)} posts` : 'Posts',
      componentIcon: CalendarCheck2,
      onclick: onPublished
    }
  ]);
  onMount(() => {
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

<Section
  spacing="none"
  class="flex min-w-0 flex-col gap-6">
  <div
    {@attach () => {
      params.toString();
      void load();
    }}>
    <h1 class="text-2xl font-bold text-text-primary">Overview</h1>
    <p class="mt-1 text-sm text-text-secondary">
      Your site activity at a glance.
    </p>
  </div>
  <AnalyticsPeriod
    {params}
    onchange={period} />
  {#if error}<ErrorState
      title="Unable to update overview"
      description={error}
      onRetry={load} />{/if}
  {#if data}<p
      class="text-xs text-text-muted"
      role="status">
      Updated {activityTimestamp(data.updatedAt, data.timeZone)} · {data.timeZone}
    </p>{/if}
  <StatsGrid
    {stats}
    variant="funding" />
  <Card density="padded">
    {#if calendarError}<ErrorState
        title="Unable to load calendar"
        description={calendarError}
        onRetry={load} />
    {:else if calendar && calendar.timeZone === params.get('timeZone')}<ViewsCalendar
        data={calendar} />
    {:else}<LoadingState label="Loading calendar…" />{/if}
  </Card>
  <Card
    id="admin-readers"
    tabindex={-1}
    density="padded"
    class="scroll-mt-20 focus-visible:outline-2 focus-visible:outline-focus-ring">
    {#if loading && !data}<LoadingState label="Loading analytics…" />
    {:else if data}<ViewsChart
        data={data.series}
        timeZone={data.timeZone} />{/if}
  </Card>
  <div class="grid min-w-0 gap-4 xl:grid-cols-2">
    {#each ['reports', 'feedback'] as area (area)}
      <Card density="padded">
        <div class="mb-4 flex items-center justify-between gap-2">
          <h2 class="text-base font-bold text-text-primary">
            {area === 'reports' ? 'Reported comments' : 'User feedback'}
          </h2>
          <Button
            type="ghost"
            size="sm"
            onclick={() => onNavigate(area as WorkspaceArea)}>View all</Button>
        </div>
        {#if !data}<LoadingState label="Loading activity…" />
        {:else if !data[area as 'reports' | 'feedback'].length}<EmptyState
            title={area === 'reports' ? 'No open reports' : (
              'No feedback in this period'
            )} />
        {:else}<ul class="divide-y divide-border-subtle">
            {#each data[area as 'reports' | 'feedback'] as item (item.id)}
              <li>
                <button
                  type="button"
                  class="flex w-full cursor-pointer flex-col gap-1 rounded-sm py-3 text-left focus-visible:outline-2 focus-visible:outline-focus-ring"
                  onclick={() => onNavigate(area as WorkspaceArea, item.id)}
                  ><span
                    class="truncate text-sm font-semibold text-text-primary"
                    >{item.title}</span
                  ><span
                    class="flex min-w-0 items-center gap-1 text-xs text-text-muted"
                    ><span class="min-w-0 truncate text-text-secondary"
                      >{area === 'reports' ?
                        `${item.author}: ${item.content}`
                      : `${helpfulPercent(item.helpful ?? 0, item.unhelpful ?? 0)} helpful`}</span
                    ><span
                      class="shrink-0"
                      aria-hidden="true">·</span
                    ><span class="shrink-0 whitespace-nowrap"
                      >{formatCount(item.total)}
                      {area === 'reports' ? 'open reports' : 'responses'}</span
                    ></span
                  ></button>
              </li>
            {/each}
          </ul>{/if}
      </Card>
    {/each}
  </div>
</Section>
