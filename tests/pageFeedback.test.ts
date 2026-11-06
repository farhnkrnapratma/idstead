// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { recordPageFeedback } from '../packages/lib/src/server/pageFeedback.ts';

const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const PUBLIC_ID = 'a'.repeat(64);
const url = new URL('https://site.test/api/internal/feedback');

function request(body: unknown, headers: Record<string, string> = {}) {
    return new Request(url, {
        method: 'POST',
        headers: { origin: url.origin, 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body)
    });
}

interface Recorded {
    target: unknown;
    input: { operationId: string; vote: string; ipHash: string };
}

function setup(
    result: unknown = { status: 'recorded', recorded: true, replayed: false },
    found: unknown = { status: 'found', post: { id: 'post-1' } }
) {
    const recorded: Recorded[] = [];
    const data = {
        blog: { findPublished: async () => found },
        feedback: {
            record: async (target: unknown, input: Recorded['input']) => {
                recorded.push({ target, input });
                return result;
            }
        }
    };
    return { recorded, data: data as never };
}

async function post(
    body: unknown,
    options: {
        data?: never | null;
        secret?: string;
        ip?: () => string;
        headers?: Record<string, string>;
    } = {}
) {
    const fixture = setup();
    const response = await recordPageFeedback({
        request: request(body, options.headers),
        url,
        ip: options.ip ?? (() => '203.0.113.5'),
        secret: 'secret' in options ? options.secret : 'pepper',
        data: 'data' in options ? (options.data ?? null) : fixture.data
    });
    return { response, fixture };
}

const legal = { operationId: UUID, vote: 'yes', targetType: 'legal', targetId: 'privacy' };
const article = { operationId: UUID, vote: 'no', targetType: 'article', targetId: PUBLIC_ID };
const text = async (response: Response) => JSON.stringify(await response.json());

describe('recordPageFeedback', () => {
    test('rejects cross-origin requests', async () => {
        const origin = await post(legal, { headers: { origin: 'https://evil.test' } });
        expect(origin.response.status).toBe(403);
        const site = await post(legal, { headers: { 'sec-fetch-site': 'cross-site' } });
        expect(site.response.status).toBe(403);
        expect(await text(site.response)).toContain('FORBIDDEN_ORIGIN');
    });

    test('rejects invalid input', async () => {
        for (const body of [
            { ...legal, operationId: 'bad' },
            { ...legal, vote: 'maybe' },
            { ...legal, targetType: 'legal', targetId: 'unknown' },
            { ...legal, targetType: 'other' }
        ]) {
            const { response } = await post(body);
            expect(response.status).toBe(400);
            expect(await text(response)).toContain('FEEDBACK_INVALID');
        }
        const wrongType = await post(legal, { headers: { 'content-type': 'text/plain' } });
        expect(wrongType.response.status).toBe(415);
    });

    test('is unavailable without data or a secret', async () => {
        expect((await post(legal, { data: null })).response.status).toBe(503);
        expect((await post(legal, { secret: '  ' })).response.status).toBe(503);
        expect((await post(legal, { secret: undefined })).response.status).toBe(503);
        expect((await post(legal, { ip: () => '' })).response.status).toBe(503);
    });

    test('records legal feedback with a hashed address', async () => {
        const { response, fixture } = await post(legal);
        expect(response.status).toBe(201);
        expect(await response.json()).toEqual({ recorded: true, replayed: false });
        expect(fixture.recorded[0].target).toEqual({ type: 'legal', page: 'privacy' });
        expect(fixture.recorded[0].input.operationId).toBe(UUID);
    });

    test('records article feedback', async () => {
        const fixture = setup();
        const response = await recordPageFeedback({
            request: request(article),
            url,
            ip: () => '203.0.113.5',
            secret: 'pepper',
            data: fixture.data
        });
        expect(response.status).toBe(201);
        expect(fixture.recorded[0].target).toEqual({ type: 'article', post: { id: 'post-1' } });
        expect(fixture.recorded[0].input.vote).toBe('no');
        expect(fixture.recorded[0].input.ipHash).not.toContain('203.0.113.5');
    });

    test('reports missing articles', async () => {
        for (const targetId of ['short', 7]) {
            const { response } = await post({ ...article, targetId });
            expect(response.status).toBe(404);
        }
        const missing = setup(undefined, { status: 'not-found' });
        const response = await recordPageFeedback({
            request: request(article),
            url,
            ip: () => '203.0.113.5',
            secret: 'pepper',
            data: missing.data
        });
        expect(response.status).toBe(404);
    });

    test('maps store results', async () => {
        const run = async (result: unknown) => {
            const fixture = setup(result);
            return recordPageFeedback({
                request: request(legal),
                url,
                ip: () => '203.0.113.5',
                secret: 'pepper',
                data: fixture.data
            });
        };
        expect((await run({ status: 'operation-conflict' })).status).toBe(409);
        expect((await run({ status: 'target-not-found' })).status).toBe(404);
        expect((await run({ status: 'ok', recorded: true, replayed: true })).status).toBe(200);
        expect((await run({ status: 'ok', recorded: false, replayed: false })).status).toBe(200);
    });

    test('maps unexpected failures to unavailable', async () => {
        const failing = {
            blog: { findPublished: async () => null },
            feedback: {
                record: async () => {
                    throw new Error('boom');
                }
            }
        } as never;
        const response = await recordPageFeedback({
            request: request(legal),
            url,
            ip: () => '203.0.113.5',
            secret: 'pepper',
            data: failing
        });
        expect(response.status).toBe(503);
        expect(await text(response)).toContain('Feedback could not be saved');
    });
});
