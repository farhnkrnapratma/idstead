import type { NotificationSummary } from '#lib/adminWorkspace.ts';
import { supabase } from '#lib/supabase.ts';
import { adminActivityRequest } from '../adminActivityClient.ts';
import type {
    AdminNotificationRow,
    ClearOperation,
    InboxCursor,
    InboxPreferences,
    InboxResult
} from '#lib/adminActivity.ts';
import { toastStore } from '@fkp/ui/stores/toastStore.svelte.ts';

const defaults: InboxPreferences = {
    query: '',
    type: 'all',
    read: 'all',
    sort: 'date',
    direction: 'desc'
};
let preferences = $state<InboxPreferences>({ ...defaults });
let items = $state.raw<AdminNotificationRow[]>([]);
let nextCursor = $state.raw<InboxCursor | null>(null);
let unreadCount = $state(0);
let total = $state(0);
let isLoaded = $state(false);
let isLoading = $state(false);
let isMutating = $state(false);
let error = $state('');
let activityError = $state('');
let pages = 1;
let generation = 0;
let requestId = 0;
let controller: AbortController | undefined;
let channel: ReturnType<typeof supabase.channel> | null = null;
let timer: ReturnType<typeof setInterval> | undefined;

let restored = false;
const listeners: Array<() => Promise<void>> = [];

function restore() {
    if (restored) return;
    restored = true;
    try {
        const saved = JSON.parse(sessionStorage.getItem('admin-inbox-preferences') ?? 'null');
        if (
            saved
            && typeof saved.query === 'string'
            && saved.query.length <= 200
            && [
                'all',
                'comment_new',
                'comment_report',
                'helpful',
                'unhelpful',
                'contact_message',
                'feedback_report'
            ].includes(saved.type)
            && ['all', 'unread', 'read'].includes(saved.read)
            && ['date', 'type', 'page'].includes(saved.sort)
            && ['asc', 'desc'].includes(saved.direction)
        )
            preferences = saved;
    } catch {}
}
async function loadInbox(append = false) {
    restore();
    if (isMutating || (append && (!nextCursor || isLoading))) return;
    controller?.abort();
    controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
    const current = ++requestId;
    const session = generation;
    isLoading = true;
    try {
        let cursor = append ? nextCursor : null;
        let rows: AdminNotificationRow[] = append ? [...items] : [];
        let latest: InboxResult | undefined;
        const count = append ? 1 : pages;
        for (let index = 0; index < count; index++) {
            latest = await adminActivityRequest<InboxResult>(
                'notifications',
                { ...preferences, ...(cursor ? { cursor: JSON.stringify(cursor) } : {}) },
                undefined,
                signal
            );
            rows = [...rows, ...latest.items];
            cursor = latest.nextCursor;
            if (!cursor) break;
        }
        if (current !== requestId || session !== generation || !latest) return;
        items = [...new Map(rows.map(row => [row.id, row])).values()];
        nextCursor = cursor;
        unreadCount = latest.unreadCount;
        total = latest.total;
        if (append) pages = Math.min(pages + 1, 3);
        items = items.slice(-60);
        isLoaded = true;
        error = '';
    } catch (caught) {
        if (current === requestId && session === generation)
            error = caught instanceof Error ? caught.message : 'Notifications could not be loaded.';
    } finally {
        if (current === requestId && session === generation) isLoading = false;
    }
}
let revision = '';
let summaryRequest: Promise<void> | undefined;
let scheduled: ReturnType<typeof setTimeout> | undefined;
let lastSummaryAt = 0;
async function load() {
    if (summaryRequest) return summaryRequest;
    const session = generation;
    summaryRequest = (async () => {
        try {
            const result = await adminActivityRequest<NotificationSummary>('workspace', {
                section: 'summary'
            });
            if (session !== generation) return;
            unreadCount = result.unreadCount;
            total = result.total;
            isLoaded = true;
            activityError = '';
            if (revision !== result.revision) {
                revision = result.revision;
                await Promise.allSettled([...listeners].map(listener => listener()));
            }
        } catch {
            if (session === generation)
                activityError = 'Updates could not be checked. Refresh to try again.';
        } finally {
            lastSummaryAt = Date.now();
            summaryRequest = undefined;
        }
    })();
    return summaryRequest;
}
function scheduleRefresh() {
    if (scheduled || document.visibilityState !== 'visible') return;
    scheduled = setTimeout(
        () => {
            scheduled = undefined;
            void load();
        },
        Math.max(0, 5000 - (Date.now() - lastSummaryAt))
    );
}
function setPreferences(change: Partial<InboxPreferences>) {
    preferences = { ...preferences, ...change };
    pages = 1;
    nextCursor = null;
    items = [];
    isLoaded = false;
    try {
        sessionStorage.setItem('admin-inbox-preferences', JSON.stringify(preferences));
    } catch {}
    void loadInbox();
}
function refreshVisible() {
    if (document.visibilityState === 'visible') scheduleRefresh();
}
function subscribe() {
    if (channel) return;
    const session = generation;
    channel = supabase
        .channel('admin-notifications')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'db_admin_notifications' },
            () => {
                if (session === generation) scheduleRefresh();
            }
        )
        .subscribe(status => {
            if (status === 'SUBSCRIBED' && session === generation) void load();
        });
    timer = setInterval(refreshVisible, 30000);
    document.addEventListener('visibilitychange', refreshVisible);
    window.addEventListener('focus', refreshVisible);
    window.addEventListener('online', refreshVisible);
}
function unsubscribe() {
    generation++;
    requestId++;
    controller?.abort();
    if (channel) void supabase.removeChannel(channel);
    channel = null;
    clearInterval(timer);
    clearTimeout(scheduled);
    scheduled = undefined;
    revision = '';
    document.removeEventListener('visibilitychange', refreshVisible);
    window.removeEventListener('focus', refreshVisible);
    window.removeEventListener('online', refreshVisible);
    items = [];
    unreadCount = 0;
    total = 0;
    pages = 1;
    nextCursor = null;
    isLoaded = false;
    isLoading = false;
    isMutating = false;
    error = '';
    activityError = '';
    restored = false;
}
async function mutate<T>(body: unknown): Promise<T> {
    if (isMutating) throw new Error('A notification update is already running.');
    const session = generation;
    isMutating = true;
    requestId++;
    controller?.abort();
    isLoading = false;
    try {
        return await adminActivityRequest<T>('notifications', {}, body);
    } finally {
        if (session === generation) {
            isMutating = false;
            void load();
        }
    }
}
async function action(action: 'read' | 'read_all' | 'delete' | 'pin' | 'unpin', id?: string) {
    try {
        await mutate({ action, id });
        return true;
    } catch (caught) {
        toastStore.error(caught instanceof Error ? caught.message : 'Notification update failed.');
        return false;
    }
}
export const adminNotificationsStore = {
    get items() {
        return items;
    },
    get preferences() {
        return preferences;
    },
    get unreadCount() {
        return unreadCount;
    },
    get total() {
        return total;
    },
    get isLoaded() {
        return isLoaded;
    },
    get isLoading() {
        return isLoading;
    },
    get error() {
        return error;
    },
    get activityError() {
        return activityError;
    },
    get isMutating() {
        return isMutating;
    },
    get hasMore() {
        return nextCursor !== null;
    },
    load,
    subscribe,
    unsubscribe,
    setPreferences,
    loadMore: () => loadInbox(true),
    markRead: (id: string) => action('read', id),
    markAllRead: () => action('read_all'),
    dismiss: (id: string) => action('delete', id),
    setPinned: (id: string, pinned: boolean) => action(pinned ? 'pin' : 'unpin', id),
    prepareClear: (operationId: string) =>
        mutate<ClearOperation>({ action: 'prepare_clear', operationId }),
    clear: (operationId: string) => mutate<ClearOperation>({ action: 'clear', operationId }),
    onActivityRefresh(listener: () => Promise<void>) {
        listeners.push(listener);
        return () => {
            const index = listeners.indexOf(listener);
            if (index >= 0) listeners.splice(index, 1);
        };
    }
};
