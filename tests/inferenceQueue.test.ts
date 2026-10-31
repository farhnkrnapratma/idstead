// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import { InferenceQueue } from '../packages/lib/src/server/inferenceQueue.ts';

test('InferenceQueue limits concurrently executing tasks', async () => {
    const queue = new InferenceQueue(2);
    let active = 0;
    let maxActive = 0;

    await Promise.all(
        Array.from({ length: 10 }, () =>
            queue.run(async () => {
                active++;
                maxActive = Math.max(maxActive, active);
                await new Promise(resolve => setTimeout(resolve, 5));
                active--;
            })
        )
    );

    expect(maxActive).toBe(2);
});
