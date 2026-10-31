// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export const SERVICE_STATUSES = {
    UP: { label: 'All systems operational', short: 'Operational', tone: 'success', icon: 'check' },
    HASISSUES: { label: 'Experiencing issues', short: 'Issues', tone: 'danger', icon: 'alert' },
    UNDERMAINTENANCE: {
        label: 'Under maintenance',
        short: 'Maintenance',
        tone: 'warning',
        icon: 'maintenance'
    },
    UNKNOWN: { label: 'Status unavailable', short: 'Unknown', tone: 'muted', icon: 'unknown' }
} as const;

export type ServiceStatus = keyof typeof SERVICE_STATUSES;

export function serviceStatus(value: unknown): ServiceStatus {
    return typeof value === 'string' && Object.hasOwn(SERVICE_STATUSES, value) ?
            (value as ServiceStatus)
        :   'UNKNOWN';
}
