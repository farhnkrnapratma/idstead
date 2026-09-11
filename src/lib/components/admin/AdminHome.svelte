<script lang="ts">
  import {onMount} from 'svelte';
  import {Eye, Flag, ThumbsUp, CalendarCheck2} from '@lucide/svelte';
  import {supabase} from '$lib/supabase';
  import {adminActivityRequest} from '$lib/adminActivityClient';
  import {adminNotificationsStore} from '$lib/stores/adminNotificationsStore.svelte';
  import type {ActivityFocus, DashboardTotals} from '$lib/adminActivity';
  import Card from '../Card.svelte';
  import StatsGrid from '../StatsGrid.svelte';
  import ErrorState from '../ErrorState.svelte';
  import ViewsChart from './ViewsChart.svelte';
  import UserFeedback from './UserFeedback.svelte';
  import ReportedComments from './ReportedComments.svelte';
  import {
    VIEWS_RANGES,
    type ViewsRange,
    type ViewsBucketRow
  } from './viewsRange';
  import {cn} from '$lib/utils/cn';
  let {
    onOpenComment,
    onPublished,
    focus = null,
    class: className = ''
  }: {
    onOpenComment: (postId: string, commentId: string) => void;
    onPublished: () => void;
    focus?: ActivityFocus | null;
    class?: string;
  } = $props();
  let totals = $state.raw<DashboardTotals | null>(null);
  let error = $state('');
  let viewsRange = $state<ViewsRange>('7d');
  let viewsData = $state.raw<ViewsBucketRow[]>([]);
  let viewsLoading = $state(true);
  let viewsError = $state('');
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let requestId = 0;
  let statsRequest = 0;
  let active = true;
  async function loadViews(range: ViewsRange) {
    const current = ++requestId;
    viewsLoading = true;
    const config = VIEWS_RANGES[range];
    try {
      const {data, error} = await supabase.rpc('db_views_timeseries', {
        p_since: new Date(Date.now() - config.days * 86400000).toISOString(),
        p_bucket: config.bucket,
        p_tz: timeZone
      });
      if (current !== requestId || !active) return;
      if (error) viewsError = 'ADMIN_VIEWS_UNAVAILABLE';
      else {
        viewsData = data || [];
        viewsError = '';
      }
    } catch {
      if (current === requestId && active)
        viewsError = 'ADMIN_VIEWS_UNAVAILABLE';
    } finally {
      if (current === requestId && active) viewsLoading = false;
    }
  }
  async function loadStats() {
    const current = ++statsRequest;
    try {
      const result = await adminActivityRequest<DashboardTotals>('activity');
      if (active && current === statsRequest) {
        totals = result;
        error = '';
      }
    } catch (caught) {
      if (active && current === statsRequest)
        error =
          caught instanceof Error ?
            caught.message
          : 'Dashboard could not be loaded.';
    }
  }
  async function refresh() {
    await Promise.all([loadStats(), loadViews(viewsRange)]);
  }
  onMount(() => {
    void refresh();
    const remove = adminNotificationsStore.onActivityRefresh(refresh);
    return () => {
      active = false;
      remove();
    };
  });
  function focusSection(id: string) {
    const target = document.getElementById(id);
    target?.focus({preventScroll: true});
    target?.scrollIntoView({behavior: 'smooth', block: 'start'});
  }
  const stats = $derived([
    {
      label: 'Readers',
      value:
        viewsError || (viewsLoading && !viewsData.length) ?
          '—'
        : String(viewsData.reduce((sum, row) => sum + Number(row.views), 0)),
      description: `last ${VIEWS_RANGES[viewsRange].label}`,
      componentIcon: Eye,
      onclick: () => focusSection('admin-readers')
    },
    {
      label: 'Open reports',
      value: totals ? String(totals.openReports) : '—',
      description:
        totals ?
          `${totals.reportedComments} ${totals.reportedComments === 1 ? 'comment' : 'comments'}`
        : 'Loading reports',
      componentIcon: Flag,
      onclick: () => focusSection('admin-reported-comments')
    },
    {
      label: 'Helpful',
      value:
        totals && totals.helpful + totals.unhelpful > 0 ?
          `${Math.round((totals.helpful / (totals.helpful + totals.unhelpful)) * 100)}%`
        : '—',
      description:
        totals ?
          `${totals.helpful} helpful · ${totals.unhelpful} unhelpful`
        : 'Articles and legal pages',
      componentIcon: ThumbsUp,
      onclick: () => focusSection('admin-user-feedback')
    },
    {
      label: 'Published',
      value: totals ? String(totals.published) : '—',
      description: totals ? `of ${totals.posts} posts` : 'Loading posts',
      componentIcon: CalendarCheck2,
      onclick: onPublished
    }
  ]);
</script>

<div class={cn('flex min-w-0 flex-col gap-6', className)}>
  {#if error}<ErrorState
      title="Unable to load dashboard"
      description={error}
      onRetry={loadStats} />{/if}
  {#if adminNotificationsStore.activityError}<ErrorState
      title="Unable to refresh dashboard"
      description={adminNotificationsStore.activityError}
      onRetry={() => adminNotificationsStore.load()} />{/if}
  <StatsGrid
    {stats}
    variant="funding" />
  <Card
    id="admin-readers"
    tabindex={-1}
    density="padded"
    class="scroll-mt-20 outline-none"
    ><ViewsChart
      range={viewsRange}
      data={viewsData}
      isLoading={viewsLoading}
      error={viewsError}
      onRangeChange={range => {
        viewsRange = range;
        void loadViews(range);
      }}
      onRetry={() => loadViews(viewsRange)} /></Card>
  <div class="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
    <Card density="padded"
      ><ReportedComments
        {focus}
        {onOpenComment} /></Card>
    <Card density="padded"><UserFeedback {focus} /></Card>
  </div>
</div>
