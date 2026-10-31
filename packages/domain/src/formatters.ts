// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { pluralize } from './pluralize';

interface RelativeUnit {
    unit: 'decade' | 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second';
    seconds: number;
}

const RELATIVE_UNITS: RelativeUnit[] = [
    { unit: 'decade', seconds: 315576000 },
    { unit: 'year', seconds: 31557600 },
    { unit: 'month', seconds: 2629800 },
    { unit: 'week', seconds: 604800 },
    { unit: 'day', seconds: 86400 },
    { unit: 'hour', seconds: 3600 },
    { unit: 'minute', seconds: 60 },
    { unit: 'second', seconds: 1 }
];

function toDate(input: string | Date | null | undefined): Date | null {
    if (!input) return null;
    const date = typeof input === 'string' ? new Date(input) : input;
    return isNaN(date.getTime()) ? null : date;
}

function matchRelativeUnit(diffSeconds: number): RelativeUnit {
    for (const entry of RELATIVE_UNITS) {
        if (diffSeconds >= entry.seconds) return entry;
    }
    return RELATIVE_UNITS[RELATIVE_UNITS.length - 1];
}

export function formatRelativeTime(
    input: string | Date | null | undefined,
    now: Date = new Date()
): string {
    const date = toDate(input);
    if (!date) return '';

    const diffMs = Math.max(0, now.getTime() - date.getTime());
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 1) {
        const ms = Math.max(1, diffMs);
        return `${ms} millisecond${ms === 1 ? '' : 's'} ago`;
    }

    const { unit, seconds } = matchRelativeUnit(diffSeconds);
    const value = Math.max(1, Math.floor(diffSeconds / seconds));

    return `${value} ${unit}${value === 1 ? '' : 's'} ago`;
}

export function getRelativeTimeNextUpdateMs(
    input: string | Date | null | undefined,
    now: Date = new Date()
): number {
    const date = toDate(input);
    if (!date) return 60000;

    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
    const { seconds } = matchRelativeUnit(diffSeconds);
    const value = Math.floor(diffSeconds / seconds);
    const nextThresholdSeconds = (value + 1) * seconds;
    const msUntilNext = (nextThresholdSeconds - diffSeconds) * 1000 - (diffMs % 1000);

    return Math.max(250, msUntilNext);
}

export function formatReadTime(readTimeInput?: string | number | null): string {
    if (!readTimeInput && readTimeInput !== 0) return '1 min read';
    let minutes = 1;
    if (typeof readTimeInput === 'number') {
        minutes = Math.max(1, Math.round(readTimeInput));
    } else {
        const matched = readTimeInput.match(/\d+/);
        if (matched) {
            minutes = Math.max(1, parseInt(matched[0], 10));
        }
    }
    return `${minutes} min read`;
}

export function formatCommentCount(count?: number | null): string {
    return pluralize(count || 0, 'comment');
}

export function formatViewCount(count?: number | null): string {
    return pluralize(count || 0, 'view');
}

export function formatBadgeCount(count?: number | null, max = 99): string {
    const n = count || 0;
    return n > max ? `${max}+` : String(n);
}

export function formatExactDateTime(input: string | Date | null | undefined): string {
    if (!input) return '';
    const date = typeof input === 'string' ? new Date(input) : input;
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

export function formatAbsoluteDate(
    input: string | Date | null | undefined,
    monthFormat: 'long' | 'short' = 'short',
    includeYear: boolean = false
): string {
    if (!input) return '';
    const date = typeof input === 'string' ? new Date(input) : input;
    if (isNaN(date.getTime())) return '';
    const isCurrentYear = date.getFullYear() === new Date().getFullYear();
    return date.toLocaleDateString('en-US', {
        month: monthFormat,
        day: 'numeric',
        ...(includeYear || !isCurrentYear ? { year: 'numeric' } : {})
    });
}

export function isValidTimeZone(zone: string): boolean {
    if (!zone || zone.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(zone)) return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: zone });
        return true;
    } catch {
        return false;
    }
}

export function formatMailDate(date: Date, timeZone: string): string {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
            timeZone,
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
            timeZoneName: 'longOffset'
        })
            .formatToParts(date)
            .map(part => [part.type, part.value])
    );
    const offset = parts.timeZoneName === 'GMT' ? 'GMT+0000' : parts.timeZoneName.replace(':', '');
    return `${parts.weekday} ${parts.month} ${parts.day}, ${parts.year} ${parts.hour}:${parts.minute}:${parts.second} ${offset}`;
}
