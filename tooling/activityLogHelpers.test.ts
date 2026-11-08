// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { clientAddress, logActivity } from '../packages/lib/src/server/activityLog.ts';
import type { ActivityLog } from '@idstead/data';

const realError = console.error;
let logged: unknown[][] = [];

beforeEach(() => {
    logged = [];
    console.error = (...args: unknown[]) => void logged.push(args);
});

afterEach(() => {
    console.error = realError;
});

function fakeLog(append: (entry: Record<string, unknown>) => Promise<unknown>) {
    return { append } as unknown as ActivityLog;
}

const base = {
    actor: 'ada@example.com',
    action: 'post.update',
    category: 'blog' as const,
    summary: 'Updated a post.'
};

describe('clientAddress', () => {
    test('returns the address, or null when it is missing, empty or unreadable', () => {
        expect(clientAddress()).toBeNull();
        expect(clientAddress(() => '203.0.113.7')).toBe('203.0.113.7');
        expect(clientAddress(() => '')).toBeNull();
        expect(
            clientAddress(() => {
                throw new Error('no address');
            })
        ).toBeNull();
    });
});

describe('logActivity', () => {
    test('reports a missing log without throwing', async () => {
        await logActivity(base, null);
        await logActivity(base, undefined);
        expect(logged.length).toBe(2);
    });

    test('appends the entry with defaults for optional fields', async () => {
        const entries: Record<string, unknown>[] = [];
        await logActivity(
            base,
            fakeLog(async entry => {
                entries.push(entry);
            })
        );
        expect(entries).toEqual([
            {
                actor: 'ada@example.com',
                action: 'post.update',
                category: 'blog',
                entityId: null,
                summary: 'Updated a post.',
                details: null,
                ip: null,
                ipHash: null,
                userAgent: null
            }
        ]);
    });

    test('hashes the client address with the salt and truncates the user agent', async () => {
        const entries: Record<string, unknown>[] = [];
        await logActivity(
            {
                ...base,
                entityId: 'p1',
                details: { field: 'title' },
                ip: '203.0.113.7',
                ipSalt: 'salt',
                userAgent: 'a'.repeat(400)
            },
            fakeLog(async entry => {
                entries.push(entry);
            })
        );
        const [entry] = entries;
        expect(entry.entityId).toBe('p1');
        expect(entry.details).toEqual({ field: 'title' });
        expect(entry.ip).toBe('203.0.113.7');
        expect(entry.ipHash).toMatch(/^[0-9a-f]+$/i);
        expect((entry.userAgent as string).length).toBe(300);
    });

    test('keeps the caller working when the append fails', async () => {
        await logActivity(
            base,
            fakeLog(async () => {
                throw new Error('db down');
            })
        );
        expect(logged.length).toBe(1);
        expect(String(logged[0][0])).toContain('logActivity failed');
    });
});
