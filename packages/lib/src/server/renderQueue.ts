// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { workerBinding } from '#lib/server/workerEnv.ts';

export interface RenderRefreshMessage {
    kind: 'refresh-renders';
}

interface QueueProducer<T> {
    send(body: T): Promise<unknown>;
}

export function isRenderRefreshMessage(value: unknown): value is RenderRefreshMessage {
    return (
        !!value
        && typeof value === 'object'
        && (value as Record<string, unknown>).kind === 'refresh-renders'
    );
}

export async function enqueueRenderRefresh(): Promise<boolean> {
    const queue = await workerBinding<QueueProducer<RenderRefreshMessage>>('NEWSLETTER_QUEUE');
    if (!queue) return false;
    await queue.send({ kind: 'refresh-renders' });
    return true;
}
