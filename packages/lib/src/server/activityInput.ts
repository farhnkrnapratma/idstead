// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { isLegalSlug } from '@idstead/domain/legal.ts';

export class ActivityInputError extends Error {
    public status: number;

    constructor(message: string, status = 400) {
        super(message);
        this.status = status;
    }
}
export async function activityJson(request: Request): Promise<Record<string, unknown>> {
    const limit = 4096;
    if (!request.headers.get('content-type')?.split(';')[0].trim().toLowerCase().endsWith('/json'))
        throw new ActivityInputError('A JSON request is required.', 415);
    if (Number(request.headers.get('content-length')) > limit)
        throw new ActivityInputError('The request is too large.', 413);
    const reader = request.body?.getReader();
    if (!reader) throw new ActivityInputError('A JSON request is required.');
    let body = '';
    let length = 0;
    const decoder = new TextDecoder('utf-8', { fatal: true });
    try {
        for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            length += value.length;
            if (length > limit) {
                await reader.cancel();
                throw new ActivityInputError('The request is too large.', 413);
            }
            body += decoder.decode(value, { stream: true });
        }
        body += decoder.decode();
        const parsed = JSON.parse(body);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error();
        return parsed;
    } catch (error) {
        if (error instanceof ActivityInputError) throw error;
        throw new ActivityInputError('The JSON request is invalid.');
    } finally {
        reader.releaseLock();
    }
}
export const ACTIVITY_UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function activityUuid(value: unknown): string {
    if (typeof value !== 'string' || !ACTIVITY_UUID.test(value))
        throw new ActivityInputError('A valid ID is required.');
    return value.toLowerCase();
}
export function activityTarget(type: unknown, id: unknown) {
    if (type === 'article') return { type, id: activityUuid(id) } as const;
    if (type === 'legal' && typeof id === 'string' && isLegalSlug(id)) return { type, id } as const;
    throw new ActivityInputError('A valid public page is required.');
}
