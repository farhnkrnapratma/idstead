// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { readJson } from '../apps/admin/src/lib/readJson.ts';

describe('readJson', () => {
    test('parses a JSON body', async () => {
        const response = Response.json({ success: true });
        expect(await readJson(response)).toEqual({ success: true });
    });

    test('explains an HTML error page from the platform', async () => {
        const response = new Response('<!DOCTYPE html><html>Worker exceeded CPU</html>', {
            status: 503,
            headers: { 'Content-Type': 'text/html' }
        });
        await expect(readJson(response)).rejects.toThrow(
            'The server could not finish this request. Try again in a moment.'
        );
    });

    test('reports an unexpected non-JSON success body', async () => {
        await expect(readJson(new Response('ok', { status: 200 }))).rejects.toThrow(
            'The server returned an unexpected response.'
        );
    });
});
