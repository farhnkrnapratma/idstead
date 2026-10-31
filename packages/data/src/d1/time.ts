// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

const HOUR_MS = 60 * 60 * 1000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
    let cached = formatters.get(timeZone);
    if (!cached) {
        cached = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        formatters.set(timeZone, cached);
    }
    return cached;
}

export function isTimeZone(timeZone: string): boolean {
    try {
        formatter(timeZone);
        return true;
    } catch {
        return false;
    }
}

interface ZonedParts {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
}

function zonedParts(instant: number, timeZone: string): ZonedParts {
    const parts = Object.fromEntries(
        formatter(timeZone)
            .formatToParts(new Date(instant))
            .filter(part => part.type !== 'literal')
            .map(part => [part.type, Number(part.value)])
    );
    return {
        year: parts.year,
        month: parts.month,
        day: parts.day,
        hour: parts.hour,
        minute: parts.minute,
        second: parts.second
    };
}

function offsetAt(instant: number, timeZone: string): number {
    const p = zonedParts(instant, timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return asUtc - Math.floor(instant / 1000) * 1000;
}

export function localDate(instant: number, timeZone: string): string {
    const p = zonedParts(instant, timeZone);
    return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function localMidnight(date: string, timeZone: string): number {
    const [year, month, day] = date.split('-').map(Number);
    const wall = Date.UTC(year, month - 1, day);
    let instant = wall - offsetAt(wall, timeZone);
    instant = wall - offsetAt(instant, timeZone);
    return instant;
}

export function addDays(date: string, days: number): string {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function localHourStart(instant: number, timeZone: string): number {
    const p = zonedParts(instant, timeZone);
    return instant - (p.minute * 60 + p.second) * 1000 - (((instant % 1000) + 1000) % 1000);
}

export function hourSteps(from: number, to: number, timeZone: string): number[] {
    const steps: number[] = [];
    for (let bucket = localHourStart(from, timeZone); bucket < to; bucket += HOUR_MS)
        steps.push(bucket);
    return steps;
}

export function daySteps(from: number, to: number, timeZone: string): string[] {
    const days: string[] = [];
    const last = localDate(to - 1, timeZone);
    for (let day = localDate(from, timeZone); day <= last; day = addDays(day, 1)) days.push(day);
    return days;
}

export function iso(instant: number): string {
    return new Date(instant).toISOString();
}
