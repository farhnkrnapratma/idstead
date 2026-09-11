<script lang="ts">
  import {onMount, tick} from 'svelte';
  import {SvelteSet} from 'svelte/reactivity';
  import {adminActivityRequest} from '$lib/adminActivityClient';
  import {adminNotificationsStore} from '$lib/stores/adminNotificationsStore.svelte';
  import type {
    ActivityFocus,
    ActivityPageResult,
    FeedbackGroup,
    FeedbackEvent
  } from '$lib/adminActivity';
  import ActivityRow from './ActivityRow.svelte';
  import ActivityGroupHeader from './ActivityGroupHeader.svelte';
  import Pagination from '../Pagination.svelte';
  import ErrorState from '../ErrorState.svelte';
  import EmptyState from '../EmptyState.svelte';
  import LoadingState from '../LoadingState.svelte';
  let {focus = null}: {focus?: ActivityFocus | null} = $props();
  let groups = $state.raw<ActivityPageResult<FeedbackGroup>>({
    items: [],
    offset: 0,
    total: 0,
    pageSize: 10
  });
  let histories = $state<Record<string, ActivityPageResult<FeedbackEvent>>>({});
  let historyErrors = $state<Record<string, string>>({});
  let error = $state('');
  let loading = $state(true);
  const opened = new SvelteSet<string>();
  const requests: Record<string, number> = {};
  let revealing = false;
  let revealRequest = 0;
  let groupRequest = 0;
  let active = true;
  const key = (group: FeedbackGroup) =>
    `${group.target_type}:${group.target_id}`;
  async function loadGroups(offset = groups.offset, target?: ActivityFocus) {
    const request = ++groupRequest;
    try {
      const result = await adminActivityRequest<
        ActivityPageResult<FeedbackGroup>
      >('activity', {
        section: 'feedback',
        offset: String(offset),
        ...(target ?
          {targetType: target.pageType, targetId: target.pageId}
        : {})
      });
      if (active && request === groupRequest) {
        groups = result;
        error = '';
      }
    } catch (caught) {
      if (active && request === groupRequest)
        error =
          caught instanceof Error ?
            caught.message
          : 'Feedback could not be loaded.';
    } finally {
      if (active && request === groupRequest) loading = false;
    }
  }
  async function loadHistory(
    group: FeedbackGroup,
    offset = histories[key(group)]?.offset ?? 0,
    focusId?: string
  ) {
    const id = key(group);
    const request = (requests[id] ?? 0) + 1;
    requests[id] = request;
    try {
      const result = await adminActivityRequest<
        ActivityPageResult<FeedbackEvent>
      >('activity', {
        section: 'feedback_history',
        targetType: group.target_type,
        targetId: group.target_id,
        offset: String(offset),
        ...(focusId ? {focusId} : {})
      });
      if (active && requests[id] === request) {
        histories[id] = result;
        historyErrors[id] = '';
      }
    } catch (caught) {
      if (active && requests[id] === request)
        historyErrors[id] =
          caught instanceof Error ?
            caught.message
          : 'Feedback history could not be loaded.';
    }
  }
  function toggle(group: FeedbackGroup) {
    const id = key(group);
    if (opened.has(id)) opened.delete(id);
    else {
      opened.add(id);
      void loadHistory(group);
    }
  }
  async function refresh() {
    if (revealing) return;
    await loadGroups();
    if (revealing || !active) return;
    await Promise.all(
      groups.items
        .filter(group => opened.has(key(group)))
        .map(group => loadHistory(group))
    );
  }
  async function reveal(target: ActivityFocus) {
    const request = ++revealRequest;
    revealing = true;
    await loadGroups(0, target);
    if (!active || request !== revealRequest) return;
    const group = groups.items.find(
      group =>
        group.target_type === target.pageType
        && group.target_id === target.pageId
    );
    if (group) {
      opened.add(key(group));
      await loadHistory(group, 0, target.eventId);
    }
    await tick();
    if (!active || request !== revealRequest) return;
    const element = document.getElementById(
      target.eventId ?
        `feedback-event-${target.eventId}`
      : 'admin-user-feedback'
    );
    element?.focus({preventScroll: true});
    element?.scrollIntoView({behavior: 'smooth', block: 'center'});
    revealing = false;
  }
  onMount(() => {
    if (focus?.section !== 'feedback') void loadGroups();
    const remove = adminNotificationsStore.onActivityRefresh(refresh);
    return () => {
      active = false;
      remove();
    };
  });
</script>

<section
  {@attach () => {
    if (focus?.section === 'feedback') void reveal(focus);
  }}
  id="admin-user-feedback"
  tabindex="-1"
  class="min-w-0 scroll-mt-20 outline-none">
  <h3 class="mb-3 text-sm font-bold text-text-primary">User feedback</h3>
  {#if error}<ErrorState
      title="Unable to load feedback"
      description={error}
      onRetry={() => loadGroups()} />{/if}
  {#if loading}<LoadingState
      variant="spinner"
      label="Loading feedback…" />
  {:else if !error && groups.total === 0}<EmptyState
      title="No votes yet"
      description="Feedback on articles and legal pages will appear here." />
  {:else}
    <ul class="flex flex-col gap-3">
      {#each groups.items as group (key(group))}
        {@const id = key(group)}
        <li class="rounded-md border border-border-subtle bg-surface-card">
          <ActivityGroupHeader
            title={group.page_title ?? 'Unavailable page'}
            url={group.page_url}
            description={`${group.target_type === 'article' ? 'Article' : 'Legal page'} · ${group.helpful} helpful · ${group.unhelpful} unhelpful`}
            latest={group.latest}
            expanded={opened.has(id)}
            label={`feedback for ${group.page_title}`}
            onToggle={() => toggle(group)} />
          {#if opened.has(id)}
            <div class="border-t border-border-subtle p-2">
              {#if historyErrors[id]}<ErrorState
                  title="Unable to load history"
                  description={historyErrors[id]}
                  onRetry={() => loadHistory(group)} />{/if}
              {#if histories[id]}
                <ul class="flex flex-col gap-1">
                  {#each histories[id].items as event (event.id)}
                    <li
                      id={`feedback-event-${event.id}`}
                      tabindex="-1"
                      class={`scroll-mt-20 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${focus?.eventId === event.id ? 'bg-accent-subtle/50' : ''}`}>
                      <ActivityRow
                        detail
                        item={{
                          id: event.id,
                          kind:
                            event.target_type === 'article' ?
                              'post_feedback'
                            : 'legal_feedback',
                          post_id:
                            event.target_type === 'article' ?
                              event.target_id
                            : null,
                          comment_id: null,
                          source_id: event.id,
                          page_type: event.target_type,
                          page_id: event.target_id,
                          page_title: event.page_title,
                          page_url: event.page_url,
                          created_at: event.created_at,
                          read_at: event.created_at,
                          meta: {vote: event.vote}
                        }} />
                    </li>
                  {/each}
                </ul>
                {#if histories[id].total > 20}<Pagination
                    class="mt-3"
                    page={histories[id].offset / 20 + 1}
                    totalPages={Math.ceil(histories[id].total / 20)}
                    onPageChange={page =>
                      loadHistory(group, (page - 1) * 20)} />{/if}
              {:else if !historyErrors[id]}<LoadingState
                  variant="spinner"
                  label="Loading feedback history…" />{/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
    {#if groups.total > 10}<Pagination
        class="mt-4"
        page={groups.offset / 10 + 1}
        totalPages={Math.ceil(groups.total / 10)}
        onPageChange={page => loadGroups((page - 1) * 10)} />{/if}
  {/if}
</section>
