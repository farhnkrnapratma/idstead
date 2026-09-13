<script lang="ts">
  import {tick} from 'svelte';
  import {Bell} from '@lucide/svelte';
  import IconButton from '../IconButton.svelte';
  import Button from '../Button.svelte';
  import Badge from '../Badge.svelte';
  import DialogCloseButton from '../DialogCloseButton.svelte';
  import ErrorState from '../ErrorState.svelte';
  import LoadingState from '../LoadingState.svelte';
  import EmptyState from '../EmptyState.svelte';
  import {portal} from '$lib/utils/actions';
  import {popoverPosition} from '$lib/utils/popoverPosition';
  import {adminNotificationsStore as inbox} from '$lib/stores/adminNotificationsStore.svelte';
  import {adminActivityRequest} from '$lib/adminActivityClient';
  import {formatCompactCount} from '$lib/utils/formatters';
  import {
    formatCount,
    notificationTypes,
    type WorkspacePage
  } from '$lib/adminWorkspace';
  import {cn} from '$lib/utils/cn';
  let {
    id,
    onOpen,
    size = 'sm',
    class: className = ''
  }: {
    id: string;
    onOpen: (group?: string) => void;
    size?: '2xs' | 'xs' | 'sm' | 'md' | 'lg';
    class?: string;
  } = $props();
  let isOpen = $state(false);
  let triggerEl = $state<HTMLElement | null>(null);
  let panelEl = $state<HTMLElement | null>(null);
  let data = $state.raw<WorkspacePage | null>(null);
  let loading = $state(false);
  let error = $state('');
  let controller: AbortController | undefined;
  function close() {
    isOpen = false;
    controller?.abort();
    triggerEl?.querySelector('button')?.focus();
  }
  async function open() {
    isOpen = !isOpen;
    if (!isOpen) return;
    await tick();
    panelEl?.focus();
    controller?.abort();
    controller = new AbortController();
    loading = true;
    error = '';
    try {
      let timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      try {
        timeZone =
          sessionStorage.getItem('admin-analytics-timezone') ?? timeZone;
      } catch {}
      data = await adminActivityRequest<WorkspacePage>(
        'workspace',
        {section: 'notifications', preview: 'true', timeZone, range: 'all'},
        undefined,
        controller.signal
      );
    } catch (caught) {
      if (!controller.signal.aborted)
        error =
          caught instanceof Error ?
            caught.message
          : 'Notifications could not be loaded.';
    } finally {
      loading = false;
    }
  }
  function select(group?: string) {
    close();
    onOpen(group);
  }
</script>

<svelte:window
  onclick={() => {
    if (isOpen) close();
  }}
  onkeydown={event => {
    if (isOpen && event.key === 'Escape') {
      event.preventDefault();
      close();
    }
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
      ariaLabel={`Notifications, ${formatCount(inbox.unreadCount)} unread events`}
      shortcutLabel="Notifications"
      keyboardShortcut="Alt+Shift+N"
      variant="ghost"
      {size}
      showTooltip={false}
      class="relative hover:bg-surface-hover"
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      onclick={event => {
        event.stopPropagation();
        void open();
      }}>
      <Bell class={size === 'xs' ? 'size-3.5' : 'size-4'} />
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
      aria-label="Recent notifications"
      class="fixed z-70 flex max-h-[75dvh] w-[calc(100vw-1rem)] flex-col rounded-md border border-border-subtle bg-surface-elevated font-sans shadow-lg outline-none sm:max-w-md"
      use:popoverPosition={{
        placement: 'bottom-end',
        offset: 8,
        padding: 8,
        autoMaxHeight: false,
        strategy: 'fixed',
        anchor: triggerEl
      }}
      onclick={event => event.stopPropagation()}
      onkeydown={event => {
        if (event.key === 'Tab') {
          const controls = panelEl?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href]'
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
        class="flex items-center justify-between gap-2 border-b border-border-subtle p-3">
        <div>
          <h2 class="text-sm font-bold text-text-primary">Notifications</h2>
          <p class="text-xs text-text-muted">
            {formatCount(inbox.unreadCount)} unread events
          </p>
        </div>
        <DialogCloseButton
          onClose={close}
          ariaLabel="Close notifications" />
      </div>
      <div class="min-h-0 overflow-y-auto p-3">
        {#if error}<ErrorState
            title="Unable to load notifications"
            description={error}
            onRetry={() => {
              isOpen = false;
              void open();
            }} />
        {:else if loading}<LoadingState label="Loading recent activity…" />
        {:else if !data?.items.length}<EmptyState title="No notifications" />
        {:else}<ul class="divide-y divide-border-subtle">
            {#each data.items as item (item.id)}<li>
                <button
                  type="button"
                  class="flex w-full cursor-pointer flex-col gap-1 rounded-sm py-3 text-left focus-visible:outline-2 focus-visible:outline-focus-ring"
                  onclick={() => select(item.id)}
                  ><span class="text-xs font-semibold text-accent"
                    >{notificationTypes.find(t => t.value === item.kind)?.label
                      ?? (item.vote === 'yes' ? 'Helpful' : 'Unhelpful')}</span
                  ><span class="line-clamp-2 text-sm text-text-primary"
                    >{item.title}</span
                  ><span class="text-xs text-text-muted"
                    >{formatCount(item.total)} events · {formatCount(
                      item.unread ?? 0
                    )} unread</span
                  ></button>
              </li>{/each}
          </ul>{/if}
      </div>
      <div class="border-t border-border-subtle p-3">
        <Button
          size="sm"
          fullWidth
          onclick={() => select()}>View all notifications</Button>
      </div>
    </div>
  {/if}
</div>
