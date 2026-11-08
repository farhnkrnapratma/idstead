// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import { createD1FeedbackRecorder } from '../packages/data/src/d1/activity.ts';

test('reports a feedback write that fails in the database as a data error', async () => {
    const failingDb = {
        prepare: () => {
            throw new Error('db down');
        }
    } as never;
    const recorder = createD1FeedbackRecorder(failingDb);
    await expect(
        recorder.record(
            { type: 'legal', page: 'terms' } as never,
            {
                operationId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
                vote: 'yes',
                ipHash: 'a'.repeat(64)
            } as never
        )
    ).rejects.toThrow('feedback.record');
});
