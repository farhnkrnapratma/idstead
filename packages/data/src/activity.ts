import type { PublishedPost } from './blog';

export type FeedbackVote = 'yes' | 'no';

export type LegalPageId = 'privacy' | 'security' | 'terms';

export type FeedbackTarget =
    { type: 'article'; post: PublishedPost } | { type: 'legal'; page: LegalPageId };

export interface PageFeedback {
    operationId: string;
    vote: FeedbackVote;
    ipHash: string;
}

export type FeedbackRecording =
    | { status: 'saved'; recorded: boolean; replayed: boolean }
    | { status: 'operation-conflict' }
    | { status: 'target-not-found' };

export interface FeedbackRecorder {
    record(target: FeedbackTarget, feedback: PageFeedback): Promise<FeedbackRecording>;
}

export type AdminNotificationKind = 'contact_message' | 'feedback_report';

export interface AdminNotifier {
    notify(kind: AdminNotificationKind): Promise<void>;
}

export interface ActivityEntry {
    actor: string | null;
    action: string;
    category: string;
    entityId: string | null;
    summary: string;
    details: Record<string, unknown> | null;
    ip: string | null;
    ipHash: string | null;
    userAgent: string | null;
}

export interface ActivityLog {
    append(entry: ActivityEntry): Promise<void>;
}

export interface ActivityPage {
    type: 'article' | 'legal';
    id: string;
}

export interface InboxQuery {
    query: string;
    type: string;
    read: string;
    sort: string;
    direction: string;
    cursor: { value: string; date: string; id: string } | null;
}

export interface NotificationGroupAction {
    id: string;
    asOf: string;
    timeZone: string;
    remove: boolean;
    from: string | null;
    to: string | null;
}

export type ClearNotifications = { status: 'done'; result: unknown } | { status: 'conflict' };

export interface AdminActivityStore {
    dashboard(): Promise<unknown>;
    feedbackGroups(input: { offset: number; page: ActivityPage | null }): Promise<unknown>;
    feedbackHistory(input: {
        offset: number;
        page: ActivityPage;
        focusId: string | null;
    }): Promise<unknown>;
    reportGroups(input: {
        offset: number;
        postId: string | null;
        focusId: string | null;
    }): Promise<unknown>;
    reportHistory(input: {
        commentId: string;
        reason: string | null;
        offset: number;
        focusId: string | null;
    }): Promise<unknown>;
    inbox(query: InboxQuery): Promise<unknown>;
    markRead(id: string): Promise<number>;
    markAllRead(): Promise<number>;
    remove(id: string): Promise<number>;
    setPinned(id: string, pinned: boolean): Promise<number>;
    clearNotifications(input: {
        actorId: string;
        operationId: string;
        confirm: boolean;
    }): Promise<ClearNotifications>;
    workspace(section: string, options: Record<string, unknown>): Promise<unknown>;
    notificationGroupAction(action: NotificationGroupAction): Promise<unknown>;
    deleteComment(id: string): Promise<unknown>;
}
