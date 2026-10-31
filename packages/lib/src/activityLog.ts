// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export const activityCategories = [
    { value: 'profile', label: 'Profile' },
    { value: 'resume', label: 'Resume' },
    { value: 'skills', label: 'Skills' },
    { value: 'links', label: 'Links' },
    { value: 'blog', label: 'Blog' },
    { value: 'security', label: 'Security' },
    { value: 'settings', label: 'Settings' }
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
