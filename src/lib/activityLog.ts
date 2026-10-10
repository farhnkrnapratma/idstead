export const activityCategories = [
    { value: 'profile', label: 'Profile' },
    { value: 'cv', label: 'CV' },
    { value: 'skills', label: 'Skills' },
    { value: 'links', label: 'Links' },
    { value: 'blog', label: 'Blog' },
    { value: 'auth', label: 'Auth' },
    { value: 'security', label: 'Security' }
] as const;

export const activityLogSortFields = [
    { value: 'created_at', label: 'Time' },
    { value: 'category', label: 'Category' },
    { value: 'action', label: 'Action' },
    { value: 'actor', label: 'Actor' },
    { value: 'summary', label: 'Details' },
    { value: 'ip', label: 'IP address' }
] as const;

export type ActivityLogSortField = (typeof activityLogSortFields)[number]['value'];

export const ACTIVITY_LOG_PAGE_SIZE = 10;
export const ACTIVITY_LOG_EXPORT_LIMIT = 5000;

export interface ActivityLogEntry {
    [key: string]: unknown;
    id: string;
    actor: string | null;
    action: string;
    category: string;
    summary: string;
    ip: string | null;
    created_at: string;
}
