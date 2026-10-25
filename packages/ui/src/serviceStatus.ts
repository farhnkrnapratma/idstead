export const SERVICE_STATUSES = {
    UP: { label: 'All systems operational', tone: 'success', icon: 'check' },
    HASISSUES: { label: 'Experiencing issues', tone: 'danger', icon: 'alert' },
    UNDERMAINTENANCE: { label: 'Under maintenance', tone: 'warning', icon: 'maintenance' },
    UNKNOWN: { label: 'Status unavailable', tone: 'muted', icon: 'unknown' }
} as const;

export type ServiceStatus = keyof typeof SERVICE_STATUSES;

export function serviceStatus(value: unknown): ServiceStatus {
    return typeof value === 'string' && Object.hasOwn(SERVICE_STATUSES, value) ?
            (value as ServiceStatus)
        :   'UNKNOWN';
}
