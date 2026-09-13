<script lang="ts">
  import {adminUrl, navigateAdmin} from '$lib/adminNavigation';
  import {onMount, tick} from 'svelte';
  import {analyticsPeriod} from '$lib/adminAnalytics';
  import {adminActivityRequest} from '$lib/adminActivityClient';
  import {WorkspaceFeed} from '$lib/stores/workspaceFeed.svelte';
  import {adminNotificationsStore as inbox} from '$lib/stores/adminNotificationsStore.svelte';
  import {
    notificationTypes,
    formatCount,
    helpfulPercent,
    type WorkspaceArea,
    type WorkspaceRow
  } from '$lib/adminWorkspace';
  import {REPORT_REASONS, reportReasonLabel} from '$lib/reportReasons';
  import type {AdminNotificationRow, ClearOperation} from '$lib/adminActivity';
  import Section from '$lib/layout/Section.svelte';
  import Card from '../Card.svelte';
  import Button from '../Button.svelte';
  import Input from '../Input.svelte';
  import Chip from '../Chip.svelte';
  import DataTable from '../DataTable.svelte';
  import FilterSelect from '../filter/FilterSelect.svelte';
  import LoadingState from '../LoadingState.svelte';
  import ErrorState from '../ErrorState.svelte';
  import EmptyState from '../EmptyState.svelte';
  import ConfirmationDialog from '../ConfirmationDialog.svelte';
  import FieldMessage from '../FieldMessage.svelte';
  import ActivityRow from './ActivityRow.svelte';
  import AnalyticsPeriod from './AnalyticsPeriod.svelte';
  import ViewsChart from './ViewsChart.svelte';
  let {
    area,
    onOpenComment,
    onSelectNotification
  }: {
    area: WorkspaceArea;
    onOpenComment: (postId: string, commentId: string) => void;
    onSelectNotification: (item: AdminNotificationRow) => void;
  } = $props();
  const list = new WorkspaceFeed();
  const detail = new WorkspaceFeed();
  let dirty = $state(false);
  let search = $state('');
  let detailSearch = $state('');
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let detailDebounce: ReturnType<typeof setTimeout> | undefined;
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
  const listCursors: Array<string | null> = [];
  const detailCursors: Array<string | null> = [];
  const params = $derived(adminUrl().searchParams);
  const selected = $derived(params.get('selected') ?? '');
  const title = $derived(
    area === 'reports' ? 'Reported comments'
    : area === 'feedback' ? 'User feedback'
    : 'Notifications'
  );
  const showHistory = $derived(
    area !== 'feedback'
      || params.get('history') === 'true'
      || params.has('focus')
  );
  const timeZone = $derived(params.get('timeZone') ?? 'UTC');
  const source = $derived(
    area === 'reports' ? 'report_events'
    : area === 'feedback' ? 'feedback_events'
    : 'notification_events'
  );
  function navigate(values: Record<string, string | null>, replace = false) {
    const url = adminUrl();
    for (const [key, value] of Object.entries(values))
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    navigateAdmin(url, replace);
  }
  function filter(values: Record<string, string>) {
    listCursors.length = 0;
    list.invalidate();
    navigate({
      ...values,
      cursor: null,
      selected: null,
      detailCursor: null,
      focus: null
    });
  }
  function period(values: Record<string, string>) {
    listCursors.length = 0;
    detailCursors.length = 0;
    list.invalidate();
    detail.invalidate();
    navigate({...values, cursor: null, detailCursor: null}, true);
  }
  function options(isDetail = false) {
    const values = Object.fromEntries(params);
    const query: Record<string, string> = {
      ...values,
      section: isDetail ? source : area
    };
    for (const key of [
      'tab',
      'selected',
      'cursor',
      'detailCursor',
      'detailQuery',
      'detailReason',
      'start',
      'end',
      'history'
    ])
      delete query[key];
    if (isDetail) {
      query.id = selected;
      if (params.has('notificationId'))
        query.notificationId = params.get('notificationId')!;
      if (area === 'feedback')
        query.history =
          params.has('focus') ? 'true' : (params.get('history') ?? 'false');
      query.query = params.get('detailQuery') ?? '';
      query.reason = params.get('detailReason') ?? '';
      query.vote = params.get('vote') ?? 'all';
      query.type = 'all';
      query.read = 'all';
      query.sort = 'date';
      if (params.has('focus')) query.focus = params.get('focus')!;
      if (params.has('detailCursor')) {
        query.cursor = params.get('detailCursor')!;
        query.meta = detail.data ? 'false' : 'true';
      }
    } else {
      delete query.focus;
      delete query.notificationId;
      if (params.has('cursor')) {
        query.cursor = params.get('cursor')!;
        query.meta = list.data ? 'false' : 'true';
      }
    }
    return query;
  }
  function sync() {
    search = params.get('query') ?? '';
    detailSearch = params.get('detailQuery') ?? '';
    if (!params.has('timeZone')) return;
    void list.load(options());
    if (selected) void detail.load(options(true));
  }
  async function open(item: WorkspaceRow) {
    groupCount = item.total;
    detailTitle = item.title;
    detailCursors.length = 0;
    detail.invalidate();
    navigate({
      selected: item.id,
      notificationId: null,
      history: null,
      detailCursor: null,
      detailQuery: null,
      detailReason: null,
      vote: null,
      focus: null
    });
    await tick();
    document.getElementById('workspace-detail')?.focus();
  }
  async function refresh() {
    listCursors.length = 0;
    detailCursors.length = 0;
    list.invalidate();
    detail.invalidate();
    dirty = false;
    try {
      const dates = analyticsPeriod(
        params.get('range') ?? (area === 'feedback' ? '7d' : 'all'),
        timeZone,
        new Date(),
        params.get('start') ?? undefined,
        params.get('end') ?? undefined
      );
      navigate({...dates, cursor: null, detailCursor: null}, true);
    } catch (caught) {
      actionError =
        caught instanceof Error ? caught.message : 'Choose a valid period.';
      return;
    }
    await tick();
    await list.load(options(), true);
    if (selected) await detail.load(options(true), true);
    await inbox.load();
  }
  function paginate(isDetail: boolean, next: boolean) {
    const feed = isDetail ? detail : list;
    const key = isDetail ? 'detailCursor' : 'cursor';
    const cursors = isDetail ? detailCursors : listCursors;
    if (next && feed.data?.nextCursor) {
      cursors.push(params.get(key));
      navigate({[key]: feed.data.nextCursor});
    } else if (!next) navigate({[key]: cursors.pop() ?? null});
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
      : null);
    if (!target) return;
    busy = true;
    actionError = '';
    try {
      await adminActivityRequest(
        'workspace',
        {},
        {
          action: remove ? 'delete_group' : 'read_group',
          ...target,
          ...detail.data?.scope
        }
      );
      confirmation = null;
      preparedGroup = null;
      if (remove) navigate({selected: null, detailCursor: null}, true);
      await refresh();
    } catch (caught) {
      actionError =
        caught instanceof Error ?
          caught.message
        : 'Unable to update notifications.';
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
      actionError =
        caught instanceof Error ?
          caught.message
        : 'Unable to prepare deletion.';
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
        caught instanceof Error ?
          caught.message
        : 'Unable to delete notifications.';
    } finally {
      busy = false;
    }
  }
  function updateDetail(values: Record<string, string>) {
    detailCursors.length = 0;
    detail.invalidate();
    navigate({...values, detailCursor: null, focus: null});
  }
  function reset() {
    search = '';
    detailSearch = '';
    listCursors.length = 0;
    detailCursors.length = 0;
    list.invalidate();
    detail.invalidate();
    const url = adminUrl();
    for (const key of [
      'query',
      'postId',
      'reason',
      'type',
      'read',
      'sort',
      'direction',
      'minimum',
      'selected',
      'cursor',
      'detailCursor',
      'focus',
      'detailQuery',
      'detailReason',
      'vote'
    ])
      url.searchParams.delete(key);
    navigateAdmin(url);
  }
  function date(value: string) {
    return new Date(value).toLocaleString('en-US', {timeZone});
  }
  const columns = $derived(
    area === 'reports' ?
      [
        {key: 'title', header: 'Comment / article'},
        {key: 'total', header: 'Open reports'},
        {key: 'reason', header: 'Top category'}
      ]
    : area === 'feedback' ?
      [
        {key: 'title', header: 'Page'},
        {key: 'total', header: 'Responses'},
        {key: 'helpful', header: 'Helpful / Unhelpful'}
      ]
    : [
        {key: 'title', header: 'Activity / page'},
        {key: 'total', header: 'Events'},
        {key: 'unread', header: 'Unread'}
      ]
  );
  const rows = $derived(
    (list.data?.items ?? []) as unknown as Record<string, unknown>[]
  );
  onMount(() => {
    const remove = inbox.onActivityRefresh(async () => {
      dirty = true;
    });
    return () => {
      clearTimeout(debounce);
      clearTimeout(detailDebounce);
      list.dispose();
      detail.dispose();
      remove();
    };
  });
</script>

<Section
  spacing="none"
  class="flex min-w-0 flex-col gap-5">
  <div
    {@attach () => {
      params.toString();
      sync();
    }}
    class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 class="text-2xl font-bold text-text-primary">{title}</h1>
      <p class="mt-1 text-sm text-text-secondary">
        {area === 'reports' ?
          'Review comments as cases. Open a case to inspect its reports.'
        : area === 'feedback' ?
          'Compare recorded responses across articles and legal pages.'
        : 'Review activity grouped by category, target, and day.'}
      </p>
    </div>
    <Button
      size="sm"
      type="outline"
      disabled={list.loading}
      onclick={refresh}
      >{dirty ? 'Updates available · Refresh' : 'Refresh'}</Button>
  </div>
  <AnalyticsPeriod
    {params}
    allowAll={area !== 'feedback'}
    onchange={period} />
  {#if area === 'notifications'}
    <div class="flex flex-wrap items-center gap-2">
      <span class="mr-auto text-sm text-text-secondary"
        >{formatCount(inbox.unreadCount)} unread events across all categories</span
      ><Button
        size="sm"
        type="ghost"
        disabled={busy || inbox.isMutating || !inbox.unreadCount}
        onclick={async () => {
          await inbox.markAllRead();
          await refresh();
        }}>Mark all read</Button
      ><Button
        size="sm"
        type="ghost"
        disabled={busy || inbox.isMutating || !inbox.total}
        onclick={prepareClear}>Clear all notifications</Button>
    </div>
  {/if}
  {#if actionError}<FieldMessage message={actionError} />{/if}
  {#if inbox.activityError}<FieldMessage message={inbox.activityError} />{/if}
  <p
    class="text-xs text-text-muted"
    role="status">
    {dirty ? 'New activity is available. Refresh when you are ready. ' : ''}{(
      list.data
    ) ?
      `Updated ${date(list.data.asOf)} · ${timeZone}`
    : 'Loading activity…'}
  </p>
  <div class={selected ? 'grid min-w-0 gap-5 xl:grid-cols-2' : 'min-w-0'}>
    <div
      class={selected ?
        'hidden min-w-0 flex-col gap-4 xl:flex'
      : 'flex min-w-0 flex-col gap-4'}>
      <Card density="padded">
        <div class="flex flex-col gap-3">
          <Input
            size="sm"
            aria-label={`Search ${title.toLowerCase()}`}
            placeholder={area === 'reports' ?
              'Search comments, authors, or articles…'
            : area === 'feedback' ? 'Search page titles…'
            : 'Search notifications…'}
            value={search}
            oninput={event => {
              search = event.currentTarget.value;
              clearTimeout(debounce);
              debounce = setTimeout(() => filter({query: search}), 300);
            }} />
          <div class="flex flex-wrap items-center gap-2">
            {#if area === 'reports'}
              <FilterSelect
                label="Category"
                value={params.get('reason') ?? ''}
                options={[
                  {value: '', label: 'All categories'},
                  ...REPORT_REASONS.map(r => ({value: r.id, label: r.label}))
                ]}
                onChange={reason => filter({reason})} />
              {#if params.has('postId')}<Chip
                  onclick={() => filter({postId: ''})}>Article filter ×</Chip
                >{/if}
            {:else if area === 'feedback'}
              <FilterSelect
                label="Page type"
                value={params.get('type') ?? 'all'}
                options={[
                  {value: 'all', label: 'All pages'},
                  {value: 'article', label: 'Articles'},
                  {value: 'legal', label: 'Legal pages'}
                ]}
                onChange={type => filter({type})} />
              <Input
                type="number"
                min="0"
                max="999999999"
                label="Minimum responses"
                size="sm"
                fullWidth={false}
                value={params.get('minimum') ?? '0'}
                onchange={event =>
                  filter({minimum: event.currentTarget.value || '0'})} />
            {:else}
              <FilterSelect
                label="Category"
                value={params.get('type') ?? 'all'}
                options={notificationTypes}
                onChange={type => filter({type})} />
              <FilterSelect
                label="Read status"
                value={params.get('read') ?? 'all'}
                options={[
                  {value: 'all', label: 'All statuses'},
                  {value: 'unread', label: 'Unread'},
                  {value: 'read', label: 'Read'}
                ]}
                onChange={read => filter({read})} />
            {/if}
            <FilterSelect
              label="Sort"
              value={params.get('sort') ?? 'date'}
              options={[
                {value: 'date', label: 'Latest activity'},
                {value: 'page', label: 'Page title'},
                ...(area === 'notifications' ?
                  [{value: 'type', label: 'Category'}]
                : [
                    {
                      value: 'total',
                      label:
                        area === 'reports' ? 'Report count' : 'Response count'
                    }
                  ]),
                ...(area === 'feedback' ?
                  [{value: 'helpful', label: 'Helpful percentage'}]
                : [])
              ]}
              onChange={sort => filter({sort})} />
            <FilterSelect
              label="Order"
              value={params.get('direction') ?? 'desc'}
              options={[
                {value: 'desc', label: 'Descending'},
                {value: 'asc', label: 'Ascending'}
              ]}
              onChange={direction => filter({direction})} />
            <Button
              type="ghost"
              size="sm"
              onclick={reset}>Reset filters</Button>
          </div>
          {#if params.get('query')}<Chip onclick={() => filter({query: ''})}
              >Search: {params.get('query')} ×</Chip
            >{/if}
        </div>
      </Card>
      {#if list.error}<ErrorState
          title="Unable to load results"
          description={list.error}
          onRetry={() => list.load(options(), true)} />{/if}
      {#if list.loading}<LoadingState label="Loading results…" />
      {:else if list.data && !list.data.items.length}<EmptyState
          title="No matching activity"
          description="Try another period or reset the filters." />
      {:else}
        <DataTable
          caption={title}
          {columns}
          data={rows}>
          {#snippet cell(raw, key)}
            {@const item = raw as unknown as WorkspaceRow}
            {#if key === 'title'}
              <button
                type="button"
                class="flex w-full cursor-pointer flex-col gap-1 rounded-sm text-left whitespace-normal focus-visible:outline-2 focus-visible:outline-focus-ring"
                onclick={() => open(item)}
                aria-label={`Open ${item.title}`}>
                {#if area === 'notifications'}<span class="text-xs text-accent"
                    >{notificationTypes.find(t => t.value === item.kind)?.label
                      ?? (item.vote === 'yes' ? 'Helpful' : 'Unhelpful')}</span
                  >{/if}
                <span class="line-clamp-2 text-sm font-semibold"
                  >{item.title}</span>
                {#if area === 'reports'}<span
                    class="line-clamp-2 text-sm font-normal text-text-secondary"
                    >{item.author}: {item.content}</span
                  >{/if}
                {#if area === 'feedback'}<span class="text-xs text-text-muted"
                    >{item.targetType === 'legal' ?
                      'Legal page'
                    : 'Article'}</span
                  >{/if}
                <span class="text-xs font-normal text-text-muted"
                  >{date(item.latest)}</span>
              </button>
            {:else if key === 'reason'}{reportReasonLabel(item.reason ?? '')}
            {:else if key === 'helpful'}<span class="block font-semibold"
                >{helpfulPercent(item.helpful ?? 0, item.unhelpful ?? 0)}</span
              ><span class="text-xs font-normal text-text-secondary"
                >{formatCount(item.helpful ?? 0)} / {formatCount(
                  item.unhelpful ?? 0
                )}</span>
            {:else}{formatCount(Number(raw[key] ?? 0))}{/if}
          {/snippet}
        </DataTable>
      {/if}
      {@render pagination(false)}
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
            onclick={() =>
              navigate({selected: null, detailCursor: null, focus: null})}
            >Back to {title.toLowerCase()}</Button
          ><span class="text-xs text-text-muted"
            >{area === 'reports' ? 'Case details' : 'Activity details'}</span>
        </div>
        {#if detail.error}<ErrorState
            title="Unable to load details"
            description={detail.error}
            onRetry={() => detail.load(options(true), true)} />{/if}
        {#if detail.loading}<LoadingState label="Loading details…" />
        {:else if detail.data}
          {#if detail.data.savedNotification?.report_status === 'resolved'}
            <Card density="padded"
              ><h2 class="mb-2 text-sm font-bold text-text-primary">
                Resolved report · Saved context
              </h2>
              <ActivityRow
                item={detail.data.savedNotification}
                detail />
              <p class="mt-2 text-sm break-words whitespace-pre-wrap">
                {detail.data.savedNotification.meta?.comment}
              </p>
              <p class="mt-2 text-sm break-words whitespace-pre-wrap">
                {detail.data.savedNotification.meta?.details}
              </p></Card>
          {/if}
          {#if area === 'reports' && detail.data.context}
            <Card density="padded"
              ><h2 class="text-base font-bold text-text-primary">
                {detail.data.context.author}
              </h2>
              <p class="mt-1 text-sm text-text-muted">
                {detail.data.context.title}
              </p>
              <p
                class="mt-4 line-clamp-4 text-sm break-words whitespace-pre-wrap text-text-primary">
                {detail.data.context.content}
              </p>
              <details class="mt-2 text-sm">
                <summary class="cursor-pointer text-accent"
                  >Read full comment</summary>
                <p class="mt-2 break-words whitespace-pre-wrap">
                  {detail.data.context.content}
                </p>
              </details>
              <div class="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onclick={() =>
                    onOpenComment(detail.data!.context!.postId!, selected)}
                  >Open comment in Posts</Button
                ><Button
                  size="sm"
                  type="ghost"
                  onclick={() =>
                    filter({postId: detail.data!.context!.postId!})}
                  >Filter this article</Button>
              </div>
              <p class="mt-3 text-xs text-text-muted">
                {formatCount(detail.data.context.total)} open reports. Report volume
                alone does not establish a violation.
              </p></Card>
            <div
              class="flex flex-wrap gap-2"
              role="group"
              aria-label="Report categories">
              <Chip
                active={!params.get('detailReason')}
                onclick={() => updateDetail({detailReason: ''})}
                >All categories</Chip
              >{#each REPORT_REASONS as reason (reason.id)}<Chip
                  active={params.get('detailReason') === reason.id}
                  onclick={() => updateDetail({detailReason: reason.id})}
                  >{reason.label} · {formatCount(
                    detail.data.reasons?.find(r => r.reason === reason.id)
                      ?.count ?? 0
                  )}</Chip
                >{/each}
            </div>
            <Input
              size="sm"
              aria-label="Search additional details"
              placeholder="Search additional details…"
              value={detailSearch}
              oninput={event => {
                detailSearch = event.currentTarget.value;
                clearTimeout(detailDebounce);
                detailDebounce = setTimeout(
                  () => updateDetail({detailQuery: detailSearch}),
                  300
                );
              }} />
          {:else if area === 'feedback'}
            {@const series = detail.data.series ?? []}
            {@const yes = series.reduce((sum, r) => sum + r.helpful, 0)}
            {@const no = series.reduce((sum, r) => sum + r.unhelpful, 0)}
            <Card density="padded"
              ><h2 class="text-base font-bold text-text-primary">
                {detail.data.context?.title
                  ?? detail.data.items[0]?.title
                  ?? (detailTitle || 'Page feedback')}
              </h2>
              <p class="mt-2 text-sm text-text-secondary">
                {formatCount(yes + no)} responses · {helpfulPercent(yes, no)} helpful
              </p>
              <p class="mt-2 text-sm text-text-primary">
                Helpful: {formatCount(yes)} · Unhelpful: {formatCount(no)}
              </p>
              <div
                class="mt-3 flex h-3 overflow-hidden rounded-full bg-surface-hover"
                aria-label={`${helpfulPercent(yes, no)} helpful`}>
                <div
                  class="bg-activity-helpful"
                  style:width={`${yes + no ? (yes / (yes + no)) * 100 : 0}%`}>
                </div>
                <div
                  class="bg-activity-unhelpful"
                  style:width={`${yes + no ? (no / (yes + no)) * 100 : 0}%`}>
                </div>
              </div></Card>
            <Card density="padded"
              ><ViewsChart
                title="Helpful responses"
                description="Recorded helpful responses during the selected period."
                data={series.map(r => ({...r, views: r.helpful}))}
                ceiling={Math.max(
                  4,
                  ...series.flatMap(r => [r.helpful, r.unhelpful])
                )}
                {timeZone} /><ViewsChart
                title="Unhelpful responses"
                description="Recorded unhelpful responses during the selected period."
                data={series.map(r => ({...r, views: r.unhelpful}))}
                ceiling={Math.max(
                  4,
                  ...series.flatMap(r => [r.helpful, r.unhelpful])
                )}
                {timeZone} /></Card>
            {#if showHistory}<FilterSelect
                label="Response"
                value={params.get('vote') ?? 'all'}
                options={[
                  {value: 'all', label: 'All responses'},
                  {value: 'yes', label: 'Helpful'},
                  {value: 'no', label: 'Unhelpful'}
                ]}
                onChange={vote => updateDetail({vote})} />{/if}
          {:else if area === 'notifications'}
            <Card density="padded"
              ><h2 class="text-base font-bold text-text-primary">
                {detail.data.items[0]?.title
                  ?? (detailTitle || 'Notification group')}
              </h2>
              <p class="mt-2 text-sm text-text-secondary">
                {formatCount(detail.data.total ?? groupCount ?? 0)} events in this
                group
              </p>
              <div class="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy}
                  onclick={() => groupAction()}>Mark group read</Button
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
          {#if area === 'feedback'}<Button
              size="sm"
              type="outline"
              aria-expanded={showHistory}
              onclick={() =>
                updateDetail({history: showHistory ? 'false' : 'true'})}
              >{showHistory ? 'Hide event history' : (
                'View event history'
              )}</Button
            >{/if}
          {#if showHistory}
            {#if params.has('focus')}<Button
                size="sm"
                type="outline"
                onclick={() => updateDetail({})}
                >Showing linked event · Show all events in this period</Button
              >{/if}
            <h3 class="text-sm font-bold text-text-primary">
              {area === 'reports' ? 'Reports' : 'Event history'}
            </h3>
            {#if !detail.data.items.length}<EmptyState
                title="No events in this view"
                description="The event may have been resolved or removed, or may fall outside the selected period." />{/if}
            <ul class="flex flex-col gap-3">
              {#each detail.data.items as item (item.id)}
                <li
                  id={`workspace-event-${item.id}`}
                  class="rounded-md border border-border-subtle bg-surface-card p-3">
                  {#if item.event}<ActivityRow
                      item={item.event}
                      detail
                      onSelect={async () => {
                        await inbox.markRead(item.id);
                        onSelectNotification(item.event!);
                      }}
                      onDelete={async () => {
                        await inbox.dismiss(item.id);
                        await refresh();
                      }}
                      disabled={busy || inbox.isMutating} />
                    {#if item.event.meta?.comment || item.event.meta?.details}
                      <details class="mt-2 text-sm">
                        <summary class="cursor-pointer text-accent"
                          >View saved context</summary>
                        {#if item.event.meta.comment}<p
                            class="mt-2 break-words whitespace-pre-wrap text-text-primary">
                            {item.event.meta.comment}
                          </p>{/if}
                        {#if item.event.meta.details}<p
                            class="mt-2 break-words whitespace-pre-wrap text-text-secondary">
                            {item.event.meta.details}
                          </p>{/if}
                      </details>
                    {/if}
                    {#if item.event.meta?.details}<details class="mt-2 text-sm">
                        <summary class="cursor-pointer text-accent"
                          >Additional details</summary>
                        <p
                          class="mt-2 break-words whitespace-pre-wrap text-text-secondary">
                          {item.event.meta.details}
                        </p>
                      </details>{/if}
                  {:else}<div class="flex flex-wrap justify-between gap-2">
                      <strong class="text-sm text-text-primary"
                        >{area === 'reports' ?
                          reportReasonLabel(item.reason ?? '')
                        : item.vote === 'yes' ? 'Helpful'
                        : 'Unhelpful'}</strong
                      ><time
                        class="text-xs text-text-muted"
                        datetime={item.latest}>{date(item.latest)}</time>
                    </div>
                    {#if area === 'reports'}<p
                        class="mt-3 line-clamp-3 text-sm break-words whitespace-pre-wrap text-text-secondary">
                        {item.details || 'No additional details provided.'}
                      </p>
                      {#if item.details}<details class="mt-2">
                          <summary class="cursor-pointer text-sm text-accent"
                            >Read full details</summary>
                          <p
                            class="mt-2 text-sm break-words whitespace-pre-wrap text-text-secondary">
                            {item.details}
                          </p>
                        </details>{/if}{/if}
                  {/if}
                </li>
              {/each}
            </ul>
            {@render pagination(true)}
          {/if}
        {/if}
      </div>
    {/if}
  </div>
</Section>

{#snippet pagination(isDetail: boolean)}
  {@const feed = isDetail ? detail : list}
  {@const cursor = params.get(isDetail ? 'detailCursor' : 'cursor')}
  <nav
    class="flex flex-wrap items-center justify-between gap-2"
    aria-label={isDetail ? 'Event pagination' : 'Results pagination'}>
    <span class="text-xs text-text-muted"
      >{formatCount(feed.data?.total ?? 0)} results · {feed.data?.items.length
        ?? 0} shown</span>
    <div class="flex gap-2">
      <Button
        size="sm"
        type="outline"
        disabled={feed.loading || !cursor}
        onclick={() => paginate(isDetail, false)}>Previous</Button
      ><Button
        size="sm"
        type="outline"
        disabled={feed.loading || !feed.data?.nextCursor}
        onclick={() => paginate(isDetail, true)}>Next</Button>
    </div>
  </nav>
{/snippet}

<ConfirmationDialog
  isOpen={confirmation !== null}
  title={confirmation === 'all' ?
    'Clear all notifications?'
  : 'Delete this notification group?'}
  message={confirmation === 'all' ?
    `Delete all ${formatCount(clearOperation?.count ?? 0)} notifications prepared for this operation? Reports and feedback remain saved. New arrivals are excluded.`
  : `Delete ${formatCount(preparedGroup?.count ?? 0)} events in this group? New arrivals are excluded. Reports and feedback remain saved.`}
  confirmLabel="Delete notifications"
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
