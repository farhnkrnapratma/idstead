// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export type AdminSettingsSection = 'general' | 'site' | 'data';

export function resolveAdminSettings(value: string | null): AdminSettingsSection {
    return value === 'site' || value === 'data' ? value : 'general';
}

export function cleanAdminParams(params: URLSearchParams, currentYear = new Date().getFullYear()) {
    const next = new URLSearchParams(params);
    if (next.get('tab') === 'home') next.delete('tab');
    if (
        next.get('tab') !== 'account' ||
        (next.has('settings') &&
            next.get('settings') !== resolveAdminSettings(next.get('settings')))
    )
        next.delete('settings');
    if (Number(next.get('calendarYear')) === currentYear) next.delete('calendarYear');
    return next;
}
