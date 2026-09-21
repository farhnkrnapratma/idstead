import type {AdminNotificationRow, DashboardTotals} from './adminActivity';

export type WorkspaceArea = 'reports' | 'feedback' | 'notifications';
export const ADMIN_WORKSPACE_PAGE_SIZE = 20;
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
  scope?: {from: string | null; to: string};
  context?: WorkspaceRow | null;
  savedNotification?: AdminNotificationRow | null;
  reasons?: {reason: string; count: number}[];
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
  {value: 'all', label: 'All'},
  {value: 'comment_report', label: 'Reports'},
  {value: 'comment_new', label: 'Comments'},
  {value: 'helpful', label: 'Helpful'},
  {value: 'unhelpful', label: 'Unhelpful'},
  {value: 'contact_message', label: 'Messages'},
  {value: 'feedback_report', label: 'Feedback forms'}
];
export function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}
export function helpfulPercent(yes: number, no: number) {
  return yes + no ? `${Math.round((yes / (yes + no)) * 100)}%` : 'No feedback';
}
export function majorityPercent(yes: number, no: number) {
  if (!(yes + no)) return 'No feedback';
  const helpfulMajority = yes >= no;
  const percent = Math.round(((helpfulMajority ? yes : no) / (yes + no)) * 100);
  return `${percent}% ${helpfulMajority ? 'helpful' : 'unhelpful'}`;
}

export interface WorkspaceCalendar {
  year: number;
  today: string;
  timeZone: string;
  updatedAt: string;
  days: {date: string; views: number}[];
}
