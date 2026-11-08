// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from 'bun:test';
import {
    activityJson,
    activityTarget,
    activityUuid
} from '../packages/lib/src/server/activityInput.ts';

const url = 'https://example.com/api/internal/activity';
const json = (body: string, headers: Record<string, string> = {}) =>
    new Request(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body
    });

test('reads a JSON object and rejects other media, sizes and shapes', async () => {
    expect(await activityJson(json('{"ok":true}'))).toEqual({ ok: true });

    const plain = new Request(url, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: '{}'
    });
    await expect(activityJson(plain)).rejects.toMatchObject({ status: 415 });

    await expect(
        activityJson(json('{"ok":true}', { 'content-length': '9999' }))
    ).rejects.toMatchObject({ status: 413 });

    const streamed = new ReadableStream({
        start(controller) {
            controller.enqueue(new TextEncoder().encode('{"a":"' + 'x'.repeat(5000)));
            controller.enqueue(new TextEncoder().encode('"}'));
            controller.close();
        }
    });
    const tooLong = new Request(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: streamed,
        duplex: 'half'
    } as RequestInit);
    await expect(activityJson(tooLong)).rejects.toMatchObject({ status: 413 });

    await expect(activityJson(json('[1,2]'))).rejects.toMatchObject({
        message: 'The JSON request is invalid.'
    });

    const empty = new Request(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' }
    });
    await expect(activityJson(empty)).rejects.toMatchObject({ status: 400 });
});

test('accepts only well-formed IDs and known public pages as targets', () => {
    expect(activityUuid('0F8FAD5B-D9CB-469F-A165-70867728950E')).toBe(
        '0f8fad5b-d9cb-469f-a165-70867728950e'
    );
    expect(() => activityUuid('not-an-id')).toThrow('A valid ID is required.');
    expect(activityTarget('legal', 'terms')).toEqual({ type: 'legal', id: 'terms' });
    expect(() => activityTarget('legal', 'no such page!')).toThrow(
        'A valid public page is required.'
    );
    expect(() => activityTarget('elsewhere', 'x')).toThrow('A valid public page is required.');
});
