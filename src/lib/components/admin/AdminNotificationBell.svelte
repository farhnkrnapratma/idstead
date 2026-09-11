<script lang="ts">
  import {tick} from 'svelte';
  import {Bell, CheckCheck, Trash2, X} from '@lucide/svelte';
  import Button from '../Button.svelte';
  import IconButton from '../IconButton.svelte';
  import Badge from '../Badge.svelte';
  import Input from '../Input.svelte';
  import ErrorState from '../ErrorState.svelte';
  import LoadingState from '../LoadingState.svelte';
  import EmptyState from '../EmptyState.svelte';
  import ConfirmationDialog from '../ConfirmationDialog.svelte';
  import FieldMessage from '../FieldMessage.svelte';
  import FilterSelect from '../filter/FilterSelect.svelte';
  import SortControl from '../filter/SortControl.svelte';
  import ActivityRow from './ActivityRow.svelte';
  import {portal} from '$lib/utils/actions';
  import {popoverPosition} from '$lib/utils/popoverPosition';
  import {adminNotificationsStore as inbox} from '$lib/stores/adminNotificationsStore.svelte';
  import type {
    AdminNotificationRow,
    ClearOperation,
    InboxPreferences
  } from '$lib/adminActivity';
  import {formatCompactCount} from '$lib/utils/formatters';
  import {cn} from '$lib/utils/cn';

  let {
    id,
    onSelect,
    class: className = ''
  }: {
    id: string;
    onSelect: (item: AdminNotificationRow) => void;
    class?: string;
  } = $props();
  let isOpen = $state(false);
  let triggerEl = $state<HTMLElement | null>(null);
  let panelEl = $state<HTMLElement | null>(null);
  let showClear = $state(false);
  let clearOperation = $state<ClearOperation | null>(null);
  let clearError = $state('');
  let preparing = $state(false);
  let clearOperationId: string | null = null;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function close() {
    isOpen = false;
    triggerEl?.querySelector('button')?.focus();
  }
  async function togglePanel(event: MouseEvent) {
    event.stopPropagation();
    isOpen = !isOpen;
    if (isOpen) {
      void inbox.load();
      await tick();
      panelEl?.focus();
    }
  }
  function select(item: AdminNotificationRow) {
    void inbox.markRead(item.id);
    close();
    onSelect(item);
  }
  async function prepareClear() {
    preparing = true;
    clearError = '';
    clearOperationId ??= crypto.randomUUID();
    try {
      clearOperation = await inbox.prepareClear(clearOperationId);
      showClear = true;
    } catch (error) {
      clearError =
        error instanceof Error ?
          error.message
        : 'Clear all could not be prepared.';
    } finally {
      preparing = false;
    }
  }
  async function confirmClear() {
    if (!clearOperation) return;
    clearError = '';
    try {
      await inbox.clear(clearOperation.operationId);
      showClear = false;
      clearOperationId = null;
      clearOperation = null;
      await tick();
      panelEl?.focus();
    } catch (error) {
      clearError =
        error instanceof Error ?
          error.message
        : 'Clear all could not be confirmed. Please try again.';
    }
  }
</script>

<svelte:window
  onclick={() => {
    if (!showClear) isOpen = false;
  }}
  onkeydown={event => {
    if (isOpen && event.key === 'Escape' && !showClear) close();
  }} />

<div class={cn('relative shrink-0', className)}>
  <span
    {@attach element => {
      triggerEl = element;
      return () => {
        triggerEl = null;
      };
    }}
    class="inline-flex">
    <IconButton
      id="admin-bell-{id}"
      ariaLabel="Notifications"
      shortcutLabel="Notifications"
      keyboardShortcut="Alt+Shift+N"
      variant="ghost"
      size="sm"
      showTooltip={false}
      class="relative hover:bg-surface-hover"
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      onclick={togglePanel}>
      <Bell class="size-4" />
      {#if inbox.unreadCount > 0}<Badge
          variant="accent"
          class="absolute -top-1 -right-1 min-w-3.5 justify-center rounded-full border-0 bg-accent-subtle px-1 py-0 text-3xs leading-3.5 text-accent"
          >{formatCompactCount(inbox.unreadCount)}</Badge
        >{/if}
    </IconButton>
  </span>
  {#if isOpen}
    <div
      {@attach element => {
        panelEl = element;
        return () => {
          panelEl = null;
        };
      }}
      use:portal
      role="dialog"
      tabindex="-1"
      aria-label="Notifications"
      class="fixed z-70 flex max-h-[calc(100dvh-1rem)] w-[56rem] max-w-[calc(100vw-1rem)] flex-col rounded-md border border-border-subtle bg-surface-elevated font-sans shadow-lg outline-none"
      use:popoverPosition={{
        placement: 'bottom-end',
        offset: 8,
        padding: 8,
        strategy: 'fixed',
        anchor: triggerEl
      }}
      onclick={event => event.stopPropagation()}
      onkeydown={event => {
        if (event.key === 'Escape' && !showClear) {
          event.stopPropagation();
          close();
        }
        if (event.key === 'Tab') {
          const controls = panelEl?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input, a[href]'
          );
          const first = controls?.[0];
          const last = controls?.[controls.length - 1];
          if (
            event.shiftKey
            && (document.activeElement === first
              || document.activeElement === panelEl)
          ) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}>
      <div
        class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-3 py-2">
        <div>
          <h2 class="text-sm font-bold text-text-primary">Notifications</h2>
          <p class="text-2xs text-text-muted">
            {timeZone} · {inbox.unreadCount} unread
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-1">
          <Button
            type="ghost"
            size="xs"
            disabled={inbox.unreadCount === 0 || inbox.isMutating}
            onclick={() => inbox.markAllRead()}
            ><CheckCheck class="size-3.5" />Mark all read</Button>
          <Button
            type="ghost"
            size="xs"
            disabled={inbox.isMutating || preparing}
            onclick={prepareClear}
            ><Trash2 class="size-3.5" />{preparing ? 'Preparing…' : (
              'Clear all'
            )}</Button>
          <IconButton
            ariaLabel="Close notifications"
            size="sm"
            onclick={close}><X class="size-4" /></IconButton>
        </div>
      </div>
      <div
        class="flex shrink-0 flex-col gap-2 border-b border-border-subtle p-2.5">
        <Input
          size="sm"
          aria-label="Search notifications"
          placeholder="Search notifications…"
          maxlength={200}
          value={inbox.preferences.query}
          oninput={event =>
            inbox.setPreferences({
              query: (event.target as HTMLInputElement).value
            })} />
        <div
          class="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2 sm:flex sm:flex-wrap sm:items-center">
          <FilterSelect
            label="Type"
            value={inbox.preferences.type}
            options={[
              {value: 'all', label: 'All'},
              {value: 'comment_report', label: 'Reports'},
              {value: 'comment_new', label: 'Comments'},
              {value: 'helpful', label: 'Helpful'},
              {value: 'unhelpful', label: 'Unhelpful'},
              {value: 'contact_message', label: 'Contact messages'},
              {value: 'feedback_report', label: 'Feedback forms'}
            ]}
            onChange={type => inbox.setPreferences({type})} />
          <FilterSelect
            label="Read status"
            value={inbox.preferences.read}
            options={[
              {value: 'all', label: 'All'},
              {value: 'unread', label: 'Unread'},
              {value: 'read', label: 'Read'}
            ]}
            onChange={read =>
              inbox.setPreferences({read: read as InboxPreferences['read']})} />
          <SortControl
            class="min-[390px]:col-span-2"
            fields={[
              {value: 'date', label: 'Date'},
              {value: 'type', label: 'Type'},
              {value: 'page', label: 'Page'}
            ]}
            currentField={inbox.preferences.sort}
            currentDirection={inbox.preferences.direction}
            onFieldChange={sort =>
              inbox.setPreferences({
                sort: sort as InboxPreferences['sort'],
                direction: sort === 'date' ? 'desc' : 'asc'
              })}
            onDirectionToggle={() =>
              inbox.setPreferences({
                direction:
                  inbox.preferences.direction === 'asc' ? 'desc' : 'asc'
              })} />
        </div>
      </div>
      {#if clearError && !showClear}<FieldMessage message={clearError} />{/if}
      <div
        class="min-h-0 overflow-y-auto overscroll-contain p-1.5"
        data-inbox-scroll>
        {#if inbox.error}<ErrorState
            title="Unable to load notifications"
            description={inbox.error}
            onRetry={() => inbox.load()}
            class="m-2 p-3" />{/if}
        {#if !inbox.isLoaded && inbox.isLoading}<LoadingState
            variant="spinner"
            label="Loading notifications…"
            class="p-4" />
        {:else if inbox.items.length === 0 && inbox.isLoaded && !inbox.error}<EmptyState
            title="No notifications"
            description="No notifications match these filters."
            class="border-0 p-4" />
        {:else}
          <ul class="flex flex-col gap-1">
            {#each inbox.items as item (item.id)}<li>
                <ActivityRow
                  {item}
                  onSelect={() => select(item)}
                  onDelete={() => inbox.dismiss(item.id)}
                  disabled={inbox.isMutating} />
              </li>{/each}
          </ul>
        {/if}
        {#if inbox.hasMore}<Button
            type="ghost"
            size="sm"
            fullWidth
            class="mt-2"
            disabled={inbox.isLoading || inbox.isMutating}
            onclick={() => inbox.loadMore()}
            >{inbox.isLoading ? 'Loading…' : 'Load more'}</Button
          >{/if}
      </div>
    </div>
  {/if}
</div>

<ConfirmationDialog
  bind:isOpen={showClear}
  title="Clear all notifications?"
  message={`Permanently delete all ${clearOperation?.count ?? ''} notifications in this snapshot, including unread notifications and those hidden by filters. Reports and feedback stay saved. Notifications arriving after this snapshot will remain.`}
  confirmLabel="Delete notifications"
  isDestructive
  isLoading={inbox.isMutating}
  onConfirm={confirmClear}
  onCancel={() => {
    clearOperationId = null;
    clearOperation = null;
    clearError = '';
  }}>
  {#if clearError}<FieldMessage message={clearError} />{/if}
</ConfirmationDialog>
