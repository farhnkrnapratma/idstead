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
  partial: boolean;
}
export interface WorkspaceOverview extends DashboardTotals {
  reads: number;
  series: AnalyticsBucket[];
  reports: WorkspaceRow[];
  feedback: WorkspaceRow[];
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
export const analyticsRanges = [
  {value: '1d', label: '24 hours'},
  {value: '7d', label: '7 days'},
  {value: '30d', label: '30 days'},
  {value: '90d', label: '90 days'},
  {value: '1y', label: '1 year'},
  {value: 'custom', label: 'Custom dates'}
];
export function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}
export function helpfulPercent(yes: number, no: number) {
  return yes + no ? `${Math.round((yes / (yes + no)) * 100)}%` : 'No feedback';
}

export interface WorkspaceCalendar {
  year: number;
  today: string;
  timeZone: string;
  updatedAt: string;
  days: {date: string; views: number}[];
}
