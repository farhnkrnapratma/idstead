<script lang="ts">
  import {onMount, tick} from 'svelte';
  import {SvelteSet} from 'svelte/reactivity';
  import {ChevronRight} from '@lucide/svelte';
  import {adminActivityRequest} from '$lib/adminActivityClient';
  import {adminNotificationsStore} from '$lib/stores/adminNotificationsStore.svelte';
  import {reportReasonLabel, reportReasonColor} from '$lib/reportReasons';
  import type {
    ActivityFocus,
    ActivityPageResult,
    ReportGroup,
    ReportHistory
  } from '$lib/adminActivity';
  import ActivityGroupHeader from './ActivityGroupHeader.svelte';
  import ActivityRow from './ActivityRow.svelte';
  import CommentReportList from './CommentReportList.svelte';
  import Pagination from '../Pagination.svelte';
  import Badge from '../Badge.svelte';
  import Button from '../Button.svelte';
  import ErrorState from '../ErrorState.svelte';
  import EmptyState from '../EmptyState.svelte';
  import LoadingState from '../LoadingState.svelte';
  let {
    focus = null,
    onOpenComment
  }: {
    focus?: ActivityFocus | null;
    onOpenComment: (postId: string, commentId: string) => void;
  } = $props();
  let articles = $state.raw<ActivityPageResult<ReportGroup>>({
    items: [],
    offset: 0,
    total: 0,
    pageSize: 10
  });
  let comments = $state<Record<string, ActivityPageResult<ReportGroup>>>({});
  let histories = $state<Record<string, ReportHistory>>({});
  let reasons = $state<Record<string, ReportHistory['reasons']>>({});
  let errors = $state<Record<string, string>>({});
  let loading = $state(true);
  const opened = new SvelteSet<string>();
  const requests: Record<string, number> = {};
  let revealing = false;
  let revealRequest = 0;
  let active = true;
  async function loadGroups(
    postId?: string,
    offset = postId ? (comments[postId]?.offset ?? 0) : articles.offset,
    focusId?: string
  ) {
    const key = postId ?? 'articles';
    const request = (requests[key] ?? 0) + 1;
    requests[key] = request;
    try {
      const result = await adminActivityRequest<
        ActivityPageResult<ReportGroup>
      >('activity', {
        section: 'reports',
        offset: String(offset),
        ...(postId ? {postId} : {}),
        ...(focusId ? {focusId} : {})
      });
      if (active && requests[key] === request) {
        if (postId) comments[postId] = result;
        else articles = result;
        errors[key] = '';
      }
    } catch (caught) {
      if (active && requests[key] === request)
        errors[key] =
          caught instanceof Error ?
            caught.message
          : 'Reports could not be loaded.';
    } finally {
      if (active && !postId) loading = false;
    }
  }
  async function loadHistory(
    commentId: string,
    reason?: string,
    offset = histories[`${commentId}:${reason}`]?.offset ?? 0,
    focusId?: string
  ) {
    const key = `${commentId}:${reason}`;
    const request = (requests[key] ?? 0) + 1;
    requests[key] = request;
    try {
      const result = await adminActivityRequest<ReportHistory>('activity', {
        section: 'report_history',
        commentId,
        offset: String(offset),
        ...(reason ? {reason} : {}),
        ...(focusId ? {focusId} : {})
      });
      if (active && requests[key] === request) {
        histories[key] = result;
        reasons[commentId] = result.reasons;
        errors[key] = '';
      }
    } catch (caught) {
      if (active && requests[key] === request)
        errors[key] =
          caught instanceof Error ?
            caught.message
          : 'Report details could not be loaded.';
    }
  }
  function toggleArticle(group: ReportGroup) {
    if (opened.has(group.id)) opened.delete(group.id);
    else {
      opened.add(group.id);
      void loadGroups(group.id);
    }
  }
  function toggleComment(group: ReportGroup) {
    if (opened.has(group.id)) opened.delete(group.id);
    else {
      opened.add(group.id);
      void loadHistory(group.id);
    }
  }
  function toggleReason(commentId: string, reason: string) {
    const key = `${commentId}:${reason}`;
    if (opened.has(key)) opened.delete(key);
    else {
      opened.add(key);
      void loadHistory(commentId, reason);
    }
  }
  async function refresh() {
    if (revealing) return;
    await loadGroups();
    if (revealing || !active) return;
    for (const article of articles.items.filter(article =>
      opened.has(article.id)
    )) {
      await loadGroups(article.id);
      if (revealing || !active) return;
      for (const comment of (comments[article.id]?.items ?? []).filter(
        comment => opened.has(comment.id)
      )) {
        await loadHistory(comment.id);
        if (revealing || !active) return;
        await Promise.all(
          (reasons[comment.id] ?? [])
            .filter(reason => opened.has(`${comment.id}:${reason.reason}`))
            .map(reason => loadHistory(comment.id, reason.reason))
        );
      }
    }
  }
  async function reveal(target: ActivityFocus) {
    const request = ++revealRequest;
    revealing = true;
    await loadGroups(undefined, 0, target.eventId);
    if (!active || request !== revealRequest) return;
    opened.add(target.pageId);
    await loadGroups(target.pageId, 0, target.eventId);
    if (!active || request !== revealRequest) return;
    if (target.commentId) {
      opened.add(target.commentId);
      await loadHistory(target.commentId);
      if (!active || request !== revealRequest) return;
      if (target.reason) {
        opened.add(`${target.commentId}:${target.reason}`);
        await loadHistory(target.commentId, target.reason, 0, target.eventId);
      }
    }
    await tick();
    if (!active || request !== revealRequest) return;
    const element =
      document.getElementById(`report-event-${target.eventId}`)
      ?? document.getElementById('admin-reported-comments');
    element?.focus({preventScroll: true});
    element?.scrollIntoView({behavior: 'smooth', block: 'center'});
    revealing = false;
  }
  onMount(() => {
    if (focus?.section !== 'reports') void loadGroups();
    const remove = adminNotificationsStore.onActivityRefresh(refresh);
    return () => {
      active = false;
      remove();
    };
  });
</script>

<section
  {@attach () => {
    if (focus?.section === 'reports') void reveal(focus);
  }}
  id="admin-reported-comments"
  tabindex="-1"
  class="min-w-0 scroll-mt-20 outline-none">
  <h3 class="mb-3 text-sm font-bold text-text-primary">Reported comments</h3>
  {#if focus?.section === 'reports' && focus.notification?.report_status === 'resolved'}
    <div class="mb-3 rounded-md border border-border-subtle p-2">
      <p class="mb-2 text-xs text-text-secondary">
        This report has been resolved. Its saved context is shown below.
      </p>
      <ActivityRow
        item={focus.notification}
        detail />{#if focus.notification.meta?.details}<p
          class="mt-2 text-xs break-words whitespace-pre-wrap text-text-secondary">
          {focus.notification.meta.details}
        </p>{/if}
    </div>
  {/if}
  {#if errors.articles}<ErrorState
      title="Unable to load reports"
      description={errors.articles}
      onRetry={() => loadGroups()} />{/if}
  {#if loading}<LoadingState
      variant="spinner"
      label="Loading reports…" />
  {:else if !errors.articles && articles.total === 0}<EmptyState
      title="No open reports"
      description="Reported comments will appear here." />
  {:else}
    <ul class="flex flex-col gap-3">
      {#each articles.items as article (article.id)}
        <li class="rounded-md border border-border-subtle bg-surface-card">
          <ActivityGroupHeader
            title={article.page_title ?? 'Unavailable article'}
            url={article.page_url}
            description={`${article.reports} ${article.reports === 1 ? 'report' : 'reports'} · ${article.comments} ${article.comments === 1 ? 'comment' : 'comments'}`}
            latest={article.latest}
            expanded={opened.has(article.id)}
            label={`reports for ${article.page_title}`}
            onToggle={() => toggleArticle(article)} />
          {#if opened.has(article.id)}
            <div class="border-t border-border-subtle p-2">
              {#if errors[article.id]}<ErrorState
                  title="Unable to load comments"
                  description={errors[article.id]}
                  onRetry={() => loadGroups(article.id)} />{/if}
              {#if comments[article.id]}
                <ul class="flex flex-col gap-2">
                  {#each comments[article.id].items as comment (comment.id)}
                    <li class="rounded-md border border-border-subtle">
                      <ActivityGroupHeader
                        title={comment.author ?? 'Anonymous'}
                        description={`${comment.content ?? ''} · ${comment.reports} ${comment.reports === 1 ? 'report' : 'reports'}`}
                        latest={comment.latest}
                        expanded={opened.has(comment.id)}
                        label={`reports on comment by ${comment.author}`}
                        onToggle={() => toggleComment(comment)} />
                      {#if opened.has(comment.id)}
                        <div
                          class="flex flex-col gap-2 border-t border-border-subtle p-2">
                          <Button
                            type="ghost"
                            size="xs"
                            class="self-start"
                            onclick={() =>
                              onOpenComment(article.id, comment.id)}
                            >Open comment in Posts</Button>
                          {#if errors[`${comment.id}:undefined`]}<ErrorState
                              title="Unable to load report reasons"
                              description={errors[`${comment.id}:undefined`]}
                              onRetry={() => loadHistory(comment.id)} />{/if}
                          {#if reasons[comment.id]}
                            {#each reasons[comment.id] as reason (reason.reason)}
                              {@const key = `${comment.id}:${reason.reason}`}
                              <div
                                class="rounded-md border border-border-subtle">
                                <button
                                  type="button"
                                  class="flex w-full cursor-pointer items-center gap-2 p-2 text-left text-text-secondary transition-colors hover:text-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring"
                                  aria-expanded={opened.has(key)}
                                  onclick={() =>
                                    toggleReason(comment.id, reason.reason)}>
                                  <ChevronRight
                                    class={`size-3.5 shrink-0 ${opened.has(key) ? 'rotate-90' : ''}`} /><Badge
                                    variant="custom"
                                    color={reportReasonColor(reason.reason)}
                                    >{reportReasonLabel(reason.reason)}</Badge
                                  ><span class="text-2xs">{reason.count}</span>
                                </button>
                                {#if opened.has(key)}
                                  {#if errors[key]}<ErrorState
                                      title="Unable to load report details"
                                      description={errors[key]}
                                      onRetry={() =>
                                        loadHistory(
                                          comment.id,
                                          reason.reason
                                        )} />{/if}
                                  {#if histories[key]}
                                    <CommentReportList
                                      reports={histories[key].items}
                                      focusedId={focus?.eventId}
                                      class="rounded-none border-x-0 border-b-0" />
                                    {#if histories[key].total > 20}<Pagination
                                        class="p-2"
                                        page={histories[key].offset / 20 + 1}
                                        totalPages={Math.ceil(
                                          histories[key].total / 20
                                        )}
                                        onPageChange={page =>
                                          loadHistory(
                                            comment.id,
                                            reason.reason,
                                            (page - 1) * 20
                                          )} />{/if}
                                  {:else if !errors[key]}<LoadingState
                                      variant="spinner"
                                      label="Loading report details…" />{/if}
                                {/if}
                              </div>
                            {/each}
                          {:else if !errors[`${comment.id}:undefined`]}<LoadingState
                              variant="spinner"
                              label="Loading report reasons…" />{/if}
                        </div>
                      {/if}
                    </li>
                  {/each}
                </ul>
                {#if comments[article.id].total > 10}<Pagination
                    class="mt-3"
                    page={comments[article.id].offset / 10 + 1}
                    totalPages={Math.ceil(comments[article.id].total / 10)}
                    onPageChange={page =>
                      loadGroups(article.id, (page - 1) * 10)} />{/if}
              {:else if !errors[article.id]}<LoadingState
                  variant="spinner"
                  label="Loading reported comments…" />{/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
    {#if articles.total > 10}<Pagination
        class="mt-4"
        page={articles.offset / 10 + 1}
        totalPages={Math.ceil(articles.total / 10)}
        onPageChange={page => loadGroups(undefined, (page - 1) * 10)} />{/if}
  {/if}
</section>
