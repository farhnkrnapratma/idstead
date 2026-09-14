<script lang="ts">
  import {adminUrl, navigateAdmin} from '$lib/adminNavigation';
  import {onMount, tick} from 'svelte';
  import {CheckCheck, Trash} from '@lucide/svelte';
  import {analyticsPeriod} from '$lib/adminAnalytics';
  import {adminActivityRequest} from '$lib/adminActivityClient';
  import {WorkspaceFeed} from '$lib/stores/workspaceFeed.svelte';
  import {adminNotificationsStore as inbox} from '$lib/stores/adminNotificationsStore.svelte';
  import {
    notificationTypes,
    formatCount,
    helpfulPercent,
    type WorkspaceArea,
    type WorkspaceRow,
    ADMIN_WORKSPACE_PAGE_SIZE
  } from '$lib/adminWorkspace';
  import {REPORT_REASONS, reportReasonLabel} from '$lib/reportReasons';
  import {
    activityTimestamp,
    type AdminNotificationRow,
    type ClearOperation
  } from '$lib/adminActivity';
  import Section from '$lib/layout/Section.svelte';
  import Card from '../Card.svelte';
  import Button from '../Button.svelte';
  import Input from '../Input.svelte';
  import Chip from '../Chip.svelte';
  import DataTable from '../DataTable.svelte';
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
  import ActivityRow from './ActivityRow.svelte';
  import AnalyticsPeriod from './AnalyticsPeriod.svelte';
  import FeedbackDonut from './FeedbackDonut.svelte';
  let {
    area,
    onOpenComment,
    onSelectNotification
  }: {
    area: WorkspaceArea;
    onOpenComment: (postId: string, commentId: string) => void;
    onSelectNotification: (item: AdminNotificationRow) => void;
  } = $props();
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
  const sortFields = $derived([
    {value: 'date', label: 'Latest'},
    {value: 'page', label: 'Page title'},
    ...(area === 'notifications' ? [{value: 'type', label: 'Category'}]
    : area === 'reports' ? [{value: 'total', label: 'Report count'}]
    : [
        {value: 'total', label: 'Response count'},
        {value: 'helpful', label: 'Helpful percentage'}
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
  function period(values: Record<string, string>) {
    list.invalidate();
    detail.invalidate();
    navigate({...values, page: null, asOf: null, detailPage: null}, true);
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
      'page',
      'detailPage',
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
      if (params.has('detailPage')) query.page = params.get('detailPage')!;
    } else {
      delete query.focus;
      delete query.notificationId;
      if (params.has('page')) query.page = params.get('page')!;
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
              {...row, event: {...event, read_at: new Date().toISOString()}}
            : row
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
    try {
      const dates = analyticsPeriod(
        params.get('range') ?? (area === 'feedback' ? '7d' : 'all'),
        timeZone,
        new Date(),
        params.get('start') ?? undefined,
        params.get('end') ?? undefined
      );
      navigate({...dates, asOf: null}, true);
    } catch (caught) {
      actionError =
        caught instanceof Error ? caught.message : 'Choose a valid period.';
      return;
    }
    await tick();
    await list.load(options(), true);
    const lastPage = Math.max(
      1,
      Math.ceil((list.data?.total ?? 0) / PAGE_SIZE)
    );
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
    if (isDetail) navigate({detailPage: value});
    else
      navigate({page: value, asOf: value ? (list.data?.asOf ?? null) : null});
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
      if (remove) navigate({selected: null, detailPage: null}, true);
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
    detail.invalidate();
    navigate({...values, detailPage: null, focus: null});
  }
  function date(value: string) {
    return activityTimestamp(value, timeZone);
  }
  function categoryLabel(item: WorkspaceRow) {
    return (
      notificationTypes.find(t => t.value === item.kind)?.label
      ?? (item.vote === 'yes' ? 'Helpful' : 'Unhelpful')
    );
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
  class="flex min-w-0 flex-col gap-5">
  <div
    {@attach () => {
      params.toString();
      sync();
    }}>
    <h1 class="text-2xl font-bold text-text-primary">{title}</h1>
    <p class="mt-1 text-sm text-text-secondary">
      {area === 'reports' ? 'Review flagged comments and decide what to do.'
      : area === 'feedback' ? 'See how readers rate your articles and pages.'
      : 'Recent activity across your site.'}
    </p>
  </div>
  <AnalyticsPeriod
    {params}
    allowAll={area !== 'feedback'}
    onchange={period} />

  {#if actionError}<FieldMessage message={actionError} />{/if}
  {#if inbox.activityError}<FieldMessage message={inbox.activityError} />{/if}
  <p
    class="text-xs text-text-muted"
    role="status">
    {list.data ? `Updated ${date(list.data.asOf)} · ${timeZone}` : 'Loading…'}
  </p>
  <div class={selected ? 'grid min-w-0 gap-5 xl:grid-cols-2' : 'min-w-0'}>
    <div
      class={selected ?
        'hidden min-w-0 flex-col gap-4 xl:flex'
      : 'flex min-w-0 flex-col gap-4'}>
      <FilterToolbar title={`${title} filters`}>
        {#snippet searchSlot()}
          <Input
            type="search"
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
        {/snippet}
        {#snippet filterControlsSlot()}
          {#if area === 'reports'}
            <Dropdown
              label="Category"
              value={params.get('reason') ?? ''}
              options={[
                {value: '', label: 'All'},
                ...REPORT_REASONS.map(r => ({value: r.id, label: r.label}))
              ]}
              onChange={reason => filter({reason})} />
            {#if params.has('postId')}<Chip onclick={() => filter({postId: ''})}
                >Article filter ×</Chip
              >{/if}
          {:else if area === 'feedback'}
            <Dropdown
              label="Page"
              value={params.get('type') ?? 'all'}
              options={[
                {value: 'all', label: 'All'},
                {value: 'article', label: 'Articles'},
                {value: 'legal', label: 'Legal pages'}
              ]}
              onChange={type => filter({type})} />
          {:else}
            <Dropdown
              label="Category"
              value={params.get('type') ?? 'all'}
              options={notificationTypes}
              onChange={type => filter({type})} />
            <Dropdown
              label="Status"
              value={params.get('read') ?? 'all'}
              options={[
                {value: 'all', label: 'All'},
                {value: 'unread', label: 'Unread'},
                {value: 'read', label: 'Read'}
              ]}
              onChange={read => filter({read})} />
          {/if}
        {/snippet}
        {#snippet sortSlot()}
          <SortControl
            labelPrefix="Sort by"
            fields={sortFields}
            currentField={params.get('sort') ?? 'date'}
            currentDirection={params.get('direction') === 'asc' ?
              'asc'
            : 'desc'}
            onFieldChange={sort => filter({sort})}
            onDirectionToggle={() =>
              filter({
                direction: params.get('direction') === 'asc' ? 'desc' : 'asc'
              })} />
        {/snippet}
        {#snippet countSlot()}
          <SearchResultCount
            count={list.data?.items.length ?? 0}
            total={list.data?.total ?? 0}
            itemLabel={area === 'reports' ? 'reported comments'
            : area === 'feedback' ? 'pages'
            : 'notifications'} />
        {/snippet}
      </FilterToolbar>
      {#if area === 'notifications'}
        <div class="flex flex-wrap items-center gap-2">
          <span class="mr-auto text-sm text-text-secondary"
            >{formatCount(inbox.unreadCount)} unread</span>
          <Button
            size="sm"
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
                            read_at:
                              row.event.read_at ?? new Date().toISOString()
                          }
                        : undefined
                    }))
                  };
                await refresh();
              }
            }}>
            {#snippet leading()}<CheckCheck class="size-3.5" />{/snippet}
            Mark all as read
          </Button>
          <Button
            size="sm"
            type="ghost"
            disabled={busy || inbox.isMutating || !readCount}
            onclick={prepareClear}>
            {#snippet leading()}<Trash class="size-3.5" />{/snippet}
            Clear all read
          </Button>
        </div>
      {/if}
      {#if list.error}<ErrorState
          title="Unable to load results"
          description={list.error}
          onRetry={() => list.load(options(), true)} />{/if}
      {#if list.loading && !list.data}<LoadingState label="Loading results…" />
      {:else if list.data && !list.data.items.length}<EmptyState
          title="No matching activity"
          description="Try another period or filter." />
      {:else if area === 'notifications'}
        <ul
          class="flex flex-col gap-2"
          aria-label="Notifications">
          {#each list.data?.items ?? [] as row (row.id)}
            {#if row.event}<li>
                <ActivityRow
                  item={row.event}
                  {timeZone}
                  disabled={busy || inbox.isMutating}
                  onSelect={() => selectEvent(row.event!)}
                  onDelete={() => deleteEvent(row.id)} />
              </li>{/if}
          {/each}
        </ul>
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
                class="flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-focus-ring"
                onclick={() => open(item)}
                aria-label={`Open ${item.title}`}>
                <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span class="truncate text-sm font-semibold"
                    >{item.title}</span>
                  <span
                    class="flex min-w-0 items-center gap-1 text-xs font-normal text-text-muted">
                    {#if area === 'reports'}
                      <span class="min-w-0 truncate text-text-secondary"
                        >{item.author}: {item.content}</span>
                    {:else if area === 'feedback'}
                      <span class="shrink-0"
                        >{item.targetType === 'legal' ?
                          'Legal page'
                        : 'Article'}</span>
                    {:else}
                      <span class="shrink-0">{categoryLabel(item)}</span>
                    {/if}
                    <span
                      class="shrink-0"
                      aria-hidden="true">·</span>
                    <time
                      class="shrink-0 whitespace-nowrap"
                      datetime={item.latest}>{date(item.latest)}</time>
                  </span>
                </span>
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
              navigate({selected: null, detailPage: null, focus: null})}
            >Back to {title.toLowerCase()}</Button
          ><span class="text-xs text-text-muted"
            >{area === 'reports' ? 'Case details' : 'Activity details'}</span>
        </div>
        {#if detail.error}<ErrorState
            title="Unable to load details"
            description={detail.error}
            onRetry={() => detail.load(options(true), true)} />{/if}
        {#if detail.loading && !detail.data}<LoadingState
            label="Loading details…" />
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
                {formatCount(detail.data.context.total)} open reports. Read the comment
                before taking action.
              </p></Card>
            <div
              class="flex flex-wrap gap-2"
              role="group"
              aria-label="Report categories">
              <Chip
                active={!params.get('detailReason')}
                onclick={() => updateDetail({detailReason: ''})}>All</Chip
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
              type="search"
              size="sm"
              aria-label="Search report details"
              placeholder="Search report details…"
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
              <FeedbackDonut
                helpful={yes}
                unhelpful={no} /></Card>
            {#if showHistory}<Dropdown
                label="Response"
                value={params.get('vote') ?? 'all'}
                options={[
                  {value: 'all', label: 'All'},
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
          {#if area === 'feedback'}<Button
              size="sm"
              type="outline"
              aria-expanded={showHistory}
              onclick={() =>
                updateDetail({history: showHistory ? 'false' : 'true'})}
              >{showHistory ? 'Hide responses' : 'View responses'}</Button
            >{/if}
          {#if showHistory}
            {#if params.has('focus')}<Button
                size="sm"
                type="outline"
                onclick={() => updateDetail({})}
                >Showing one event · Show all</Button
              >{/if}
            <h3 class="text-sm font-bold text-text-primary">
              {area === 'reports' ? 'Reports' : 'Events'}
            </h3>
            {#if !detail.data.items.length}<EmptyState
                title="Nothing here"
                description="It may have been resolved, removed, or fall outside the selected period." />{/if}
            <ul class="flex flex-col gap-3">
              {#each detail.data.items as item (item.id)}
                <li
                  id={`workspace-event-${item.id}`}
                  class="rounded-md border border-border-subtle bg-surface-card p-3">
                  {#if item.event}<ActivityRow
                      item={item.event}
                      {timeZone}
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
  {@const total = feed.data?.total ?? 0}
  {@const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))}
  {#if feed.data}
    <Pagination
      page={Number(params.get(isDetail ? 'detailPage' : 'page') ?? '1')}
      {totalPages}
      onPageChange={page => goToPage(isDetail, page)}
      class="mt-6" />
  {/if}
{/snippet}

<ConfirmationDialog
  isOpen={confirmation !== null}
  title={confirmation === 'all' ?
    'Clear read notifications?'
  : 'Delete this notification group?'}
  message={confirmation === 'all' ?
    `Delete ${formatCount(clearOperation?.count ?? 0)} read notifications? Unread notifications stay, and reports and feedback remain saved.`
  : `Delete ${formatCount(preparedGroup?.count ?? 0)} events in this group? Reports and feedback remain saved.`}
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
