// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import {
    DEFAULT_ADMIN_DISPLAY,
    formatAdminDate,
    formatAdminDateTime,
    type AdminDisplayPrefs
} from './adminDateFormat';
import { reportReasonLabel } from './reportReasons';
export type PageType = 'article' | 'legal';
export type FeedbackVote = 'yes' | 'no';
export type NotificationKind =
    | 'comment_report'
    | 'comment_new'
    | 'post_feedback'
    | 'legal_feedback'
    | 'contact_message'
    | 'feedback_report';
export interface ActivityPage {
    page_title: string | null;
    page_url: string | null;
}
export interface AdminNotificationRow extends ActivityPage {
    id: string;
    kind: NotificationKind;
    post_id: string | null;
    comment_id: string | null;
    source_id: string | null;
    page_type: PageType | null;
    page_id: string | null;
    meta: {
        reason?: string;
        vote?: FeedbackVote;
        author?: string;
        comment?: string;
        details?: string;
    } | null;
    created_at: string;
    read_at: string | null;
    pinned_at?: string | null;
    report_status?: 'open' | 'resolved' | null;
}
export interface InboxCursor {
    value: string;
    date: string;
    id: string;
}
export interface InboxResult {
    items: AdminNotificationRow[];
    nextCursor: InboxCursor | null;
    total: number;
    unreadCount: number;
}
export interface InboxPreferences {
    query: string;
    type: string;
    read: 'all' | 'unread' | 'read';
    sort: 'date' | 'type' | 'page';
    direction: 'asc' | 'desc';
}
export interface DashboardTotals {
    helpful: number;
    unhelpful: number;
    openReports: number;
    reportedComments: number;
    published: number;
    posts: number;
    allTimeReads: number;
    allTimeHelpful: number;
    allTimeUnhelpful: number;
}
export interface ClearOperation {
    operationId: string;
    count: number;
    completed: boolean;
    deletedCount: number | null;
}
export function activityDate(
    date: string,
    timeZone?: string,
    prefs: AdminDisplayPrefs = DEFAULT_ADMIN_DISPLAY
) {
    return formatAdminDate(date, timeZone, prefs.dateFormat, true);
}
export function activityTimestamp(
    date: string,
    timeZone?: string,
    prefs: AdminDisplayPrefs = DEFAULT_ADMIN_DISPLAY
) {
    return formatAdminDateTime(date, timeZone, prefs);
}
export function activityTimeZone(
    date: string,
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
) {
    const offset = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
        .formatToParts(new Date(date))
        .find(part => part.type === 'timeZoneName')?.value;
    return `${timeZone} · ${offset}`;
}
export function activityAuthor(item: AdminNotificationRow) {
    return item.meta?.author ?? 'Anonymous';
}
export function activityPageTitle(item: AdminNotificationRow) {
    return item.page_title ?? 'Unavailable page';
}
export function activityPageKind(item: AdminNotificationRow) {
    return item.page_type === 'legal' ? 'page' : 'article';
}
export function isFeedbackActivity(item: { kind: string }) {
    return item.kind === 'post_feedback' || item.kind === 'legal_feedback';
}
export function activitySentence(item: AdminNotificationRow) {
    const author = activityAuthor(item);
    const title = activityPageTitle(item);
    const pageKind = activityPageKind(item);
    if (item.kind === 'comment_report')
        return `Someone reported a comment by ${author} on the ${title} ${pageKind}.`;
    if (item.kind === 'comment_new') return `${author} commented on the ${title} ${pageKind}.`;
    if (isFeedbackActivity(item))
        return `Someone marked the ${title} ${pageKind} as ${item.meta?.vote === 'yes' ? 'helpful' : 'unhelpful'}.`;
    if (item.kind === 'contact_message') return 'Someone sent a message through the contact form.';
    return 'Someone submitted the feedback form.';
}
export function activityMetadata(item: AdminNotificationRow) {
    if (item.kind === 'comment_report')
        return `Reason: ${reportReasonLabel(item.meta?.reason ?? 'other')}${item.report_status === 'resolved' ? ' · Resolved' : ''}`;
    if (item.kind === 'comment_new') return `Comment: “${item.meta?.comment ?? ''}”`;
    if (isFeedbackActivity(item)) return '';
    return 'Check your email inbox.';
}
