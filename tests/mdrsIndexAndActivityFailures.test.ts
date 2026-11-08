// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import { expect, test } from 'bun:test';
import { unavailableResolvers } from '@mdrs/core';
import { evaluateDefineBlock } from '../packages/mdrs/core/src/define/block.ts';
import { createD1ActivityLog } from '../packages/data/src/d1/activity.ts';

test('reports index expressions that are neither numbers nor strings, and unclosed brackets', async () => {
    const badIndex = await evaluateDefineBlock('v: a[b]', unavailableResolvers());
    expect(badIndex.errors.map(error => error.message).join(' ')).toContain(
        'Expected a number or string inside [...]'
    );
    const unclosed = await evaluateDefineBlock('v: a[1 2]', unavailableResolvers());
    expect(unclosed.errors.map(error => error.message).join(' ')).toContain("Expected ']'");
});

test('reports activity log reads that fail in the database', async () => {
    const failingDb = {
        prepare: () => {
            throw new Error('db down');
        }
    } as never;
    const log = createD1ActivityLog(failingDb);
    await expect(
        log.list({
            category: null,
            query: null,
            direction: 'asc',
            sort: 'action',
            from: null,
            to: null,
            limit: 20,
            offset: 0
        })
    ).rejects.toThrow('activity.list');
});
