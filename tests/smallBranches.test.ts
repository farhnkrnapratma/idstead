// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { importPostDocument } from '../packages/mdrs/core/src/frontmatter';
import { MAX_DOCUMENT_LENGTH, validateDefineForSave } from '../packages/mdrs/core/src/define';
import { encodeIndexedPng } from '../packages/lib/src/png.ts';
import { runApi } from '../packages/lib/src/server/api/responses.ts';
import { ApiRequestError } from '../packages/lib/src/server/api/params.ts';

describe('small branches', () => {
    test('rejects markdown above the render limit before parsing it', async () => {
        const result = await validateDefineForSave('x'.repeat(MAX_DOCUMENT_LENGTH + 1), {});
        expect(result).toEqual({
            ok: false,
            errors: [{ message: 'Markdown document is too large to render.' }]
        });
    });

    test('rejects palette sizes outside 2 to 256 colors', () => {
        expect(() => encodeIndexedPng(new Uint8Array(4), 1, 1, 1)).toThrow('Invalid palette size.');
        expect(() => encodeIndexedPng(new Uint8Array(4), 1, 1, 257)).toThrow(
            'Invalid palette size.'
        );
    });

    test('maps API request errors to responses and rethrows everything else', async () => {
        const handled = await runApi(async () => {
            throw new ApiRequestError(400, 'BAD', 'Bad input.');
        });
        expect(handled.status).toBe(400);
        expect(await handled.json()).toMatchObject({ code: 'BAD', message: 'Bad input.' });
        await expect(
            runApi(async () => {
                throw new Error('unexpected');
            })
        ).rejects.toThrow('unexpected');
    });

    test('ignores tags that are neither a list nor text', () => {
        const imported = importPostDocument('---\ntitle: Hello\ntags: 5\n---\nBody');
        expect(imported.tags).toBeUndefined();
    });
});
