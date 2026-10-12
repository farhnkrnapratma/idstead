import type { AdminNotificationRow, DashboardTotals } from './adminActivity';

export type WorkspaceArea = 'reports' | 'feedback' | 'notifications';
export const ADMIN_WORKSPACE_PAGE_SIZE = 10;
export type WorkspaceSection =
    | WorkspaceArea
    | 'report_events'
    | 'feedback_events'
    | 'notification_events'
    | 'calendar'
    | 'overview'
    | 'summary'
    | 'comments';
export interface WorkspaceRow {
    id: string;
    title: string;
    latest: string;
    total: number;
    postId?: string;
    author?: string;
    content?: string;
    reason?: string;
    details?: string | null;
    helpful?: number;
    unhelpful?: number;
    unread?: number;
    kind?: string;
    targetType?: 'article' | 'legal';
    targetId?: string;
    vote?: 'yes' | 'no';
    event?: AdminNotificationRow;
    commentedAt?: string;
}

export interface TopPageEntry {
    metric: string;
    page: string;
    value: string;
    href?: string;
}
export interface WorkspacePage {
    items: WorkspaceRow[];
    page: number;
    total: number;
    asOf: string;
    scope?: { from: string | null; to: string };
    context?: WorkspaceRow | null;
    savedNotification?: AdminNotificationRow | null;
    reasons?: { reason: string; count: number }[];
    series?: AnalyticsBucket[];
}
export interface AnalyticsBucket {
    bucket: string;
    views: number;
    helpful: number;
    unhelpful: number;
    reports: Record<string, number>;
    partial: boolean;
}
export interface WorkspaceOverview extends DashboardTotals {
    reads: number;
    series: AnalyticsBucket[];
    topPages: TopPageEntry[];
    from: string;
    to: string;
    timeZone: string;
    updatedAt: string;
}
export interface NotificationSummary {
    unreadCount: number;
    total: number;
    revision: string;
}
export const notificationTypes = [
    { value: 'all', label: 'All' },
    { value: 'comment_report', label: 'Reports' },
    { value: 'comment_new', label: 'Comments' },
    { value: 'helpful', label: 'Helpful' },
    { value: 'unhelpful', label: 'Unhelpful' },
    { value: 'contact_message', label: 'Messages' },
    { value: 'feedback_report', label: 'Feedback forms' }
];
export function formatCount(value: number) {
    return new Intl.NumberFormat('en-US').format(value);
}
export function helpfulPercent(yes: number, no: number) {
    return yes + no ? `${Math.round((yes / (yes + no)) * 100)}%` : '0%';
}
export function majorityPercent(yes: number, no: number) {
    if (!(yes + no)) return '0%';
    const helpfulMajority = yes >= no;
    const percent = Math.round(((helpfulMajority ? yes : no) / (yes + no)) * 100);
    return `${percent}% ${helpfulMajority ? 'helpful' : 'unhelpful'}`;
}

export function hasChartActivity(values: readonly number[]) {
    return values.some(value => value > 0);
}

export function calendarWeekColumns(year: number) {
    const start = new Date(year, 0, 1);
    const days = Math.round((new Date(year + 1, 0, 1).getTime() - start.getTime()) / 86_400_000);
    const firstBoundary = start.getDay() === 0 ? 7 : 7 - start.getDay();
    const boundaries = days >= firstBoundary ? Math.floor((days - firstBoundary) / 7) + 1 : 0;
    return boundaries + 1;
}

export function shouldShowDataControls(total: number, filtersActive: boolean) {
    return total > 0 || filtersActive;
}

export interface WorkspaceCalendar {
    year: number;
    today: string;
    timeZone: string;
    updatedAt: string;
    days: { date: string; views: number }[];
}
