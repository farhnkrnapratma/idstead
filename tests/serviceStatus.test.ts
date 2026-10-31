import { describe, expect, test } from 'bun:test';
import { SERVICE_STATUSES, serviceStatus } from '../packages/ui/src/serviceStatus.ts';

describe('service status', () => {
    test('tells every status apart by icon and label, not only by color', () => {
        const entries = Object.values(SERVICE_STATUSES);
        expect(new Set(entries.map(entry => entry.icon)).size).toBe(entries.length);
        expect(new Set(entries.map(entry => entry.label)).size).toBe(entries.length);
        expect(new Set(entries.map(entry => entry.short)).size).toBe(entries.length);
    });

    test('maps Instatus page states and falls back to unknown', () => {
        expect(serviceStatus('UP')).toBe('UP');
        expect(serviceStatus('HASISSUES')).toBe('HASISSUES');
        expect(serviceStatus('UNDERMAINTENANCE')).toBe('UNDERMAINTENANCE');
        expect(serviceStatus('DOWN')).toBe('UNKNOWN');
        expect(serviceStatus('toString')).toBe('UNKNOWN');
        expect(serviceStatus(undefined)).toBe('UNKNOWN');
    });
});
